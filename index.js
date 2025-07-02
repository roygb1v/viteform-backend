import "dotenv/config";
import express from "express";
import { Resend } from "resend";
import WebSocket, { WebSocketServer } from "ws";
import cookieParser from "cookie-parser";
import cors from "cors";
import { createClient } from "@supabase/supabase-js";
import { combineResults } from "./utils/index.js";
import { DAY } from "./utils/constants.js";
import stripe from "stripe";
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);
const stripeClient = stripe(process.env.STRIPE_SANDBOX_API_KEY);
const app = express();
const port = 3000;
const isProduction = process.env.NODE_ENV === "production";
const ORIGIN = isProduction ? "https://viteform.io" : "http://localhost:5173";
app.use(express.json());
app.use(cookieParser());

const emailTemplate = `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Magic Link</title>
    <style>
      body {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Open Sans", "Helvetica Neue", sans-serif;
        background-color: #f9f9f9;
        margin: 0;
        padding: 0;
        color: #333;
      }
      .container {
        max-width: 600px;
        margin: 2rem auto;
        background-color: white;
        padding: 2rem;
        border-radius: 12px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
      }
      h1 {
        font-size: 1.5rem;
        margin-bottom: 1rem;
      }
      p {
        font-size: 1rem;
        line-height: 1.5;
      }
      .button {
        display: inline-block;
        margin: auto;
        margin-top: 1.5rem;
        padding: 0.75rem 1.5rem;
        background-color: #4f46e5;
        color: white;
        text-decoration: none;
        border-radius: 8px;
        font-weight: 600;
      }
      .loginText {
        color: white;
      }
      .footer {
        margin-top: 2rem;
        font-size: 0.875rem;
        color: #888;
        text-align: center;
      }
    </style>
  </head>
  <body>
    <div class="container">
      <h1>🔐 Log in to Viteform</h1>
      <p>Hello,</p>
      <p>Click the button below to log in securely to your account:</p>

      <a href="{{MAGIC_LINK}}" class="button"><p class="loginText">Log In Now</p></a>

      <p>If you didn't request this, you can safely ignore this email.</p>

      <div class="footer">
        &copy; {{YEAR}} Viteform, All rights reserved.
      </div>
    </div>
  </body>
</html>
`;

(function () {
  if (isProduction) return;

  // [IMPORTANT] - Remove this in production
  app.use(cors({ credentials: true, origin: ORIGIN }));
})();

const resend = new Resend(process.env.RESEND_API_KEY);

const wss = new WebSocketServer({ port: 8080 });

const EMPTY_ROOM_STATE = {
  maxCapacity: 20,
  isLocked: false,
  hasStarted: false,
  password: null,
  timeLimit: 10000,
  clients: [],
  data: null,
  state: {
    current: null,
    status: "active",
    round: 0,
    totalQuestions: 0,
  },
  responses: {
    // questionId1: {
    //   userId1: { response: "Paris", isCorrect: true, timestamp: Date.now() },
    //   userId2: { response: "Paris", isCrrect: true, timestamp: Date.now() },
    //   userId3: { response: "Berlin", isCorrect: false, timestamp: Date.now() },
    //   userid4: { response: "Test", isCorrect: false, timestamp: Date.now() },
    // },
  },
  leaderboard: {
    // scores: {
    //   userId1: 1,
    //   userId2: 1,
    //   userId3: 0,
    //   userId4: 0,
    // },
  },
};

// move this to backend
const rooms = {
  xxx: structuredClone(EMPTY_ROOM_STATE),
};

wss.on("connection", (ws) => {
  ws.on("error", console.error);
  console.log("connected");

  let userId;
  let roomId;

  ws.on("message", async (data, isBinary) => {
    try {
      const parsed = JSON.parse(data);

      const { message, action, user } = parsed;
      userId = user.id;

      switch (action) {
        case "join":
          console.log("joining..");
          break;
        case "reconnect":
          console.log("reconnecting...", parsed);
          if (parsed?.roomId && rooms[parsed.roomId]) {
            const clientIndex = rooms[parsed.roomId].clients.findIndex(
              (client) => client.id === user.id
            );
            if (clientIndex > -1) {
              const transformedClient = {
                ...rooms[parsed.roomId].clients[clientIndex],
                isConnected: true,
              };
              rooms[parsed.roomId].clients.splice(
                clientIndex,
                1,
                transformedClient
              );
            }
          }
          break;
        case "response":
          const { questionId } = message;
          const room = rooms[roomId];

          const storedQuestion = room.responses[questionId] ?? {};
          const updatedResponse = {
            ...storedQuestion,
            [user.id]: {
              questionId: message.questionId,
              answer: message.answer,
              isCorrect: message.isCorrect,
              timestamp: Date.now(),
            },
          };
          room.responses[questionId] = updatedResponse;

          const haveAllClientsAnswered =
            rooms[roomId].clients.length ===
            Object.keys(updatedResponse).length;

          if (haveAllClientsAnswered) {
            // Update state
            const currentRound = rooms[roomId].state.round;
            rooms[roomId].state.round = currentRound + 1;

            if (
              rooms[roomId].state.round >= rooms[roomId].data.questions.length
            ) {
              rooms[roomId].state.status = "inactive"; // ??
              wss.clients.forEach(function each(client) {
                if (client.readyState === WebSocket.OPEN) {
                  client.send(
                    JSON.stringify({
                      ...rooms[roomId],
                      state: {
                        ...rooms[roomId].state,
                        status: "inactive",
                      },
                      status: {
                        userId,
                        completed: true,
                      },
                    }),
                    { binary: isBinary }
                  );
                }
              });

              // Reset form
              rooms[roomId] = JSON.parse(
                JSON.stringify({
                  ...structuredClone(EMPTY_ROOM_STATE),
                  data: rooms[roomId].data,
                })
              );

              // Remove oneself on client and server
              const clientIndex = rooms[parsed.roomId]?.clients.findIndex(
                (client) => client.id === user.id
              );
              rooms[parsed.roomId].clients.splice(clientIndex, 1, 0);

              return;
            }

            rooms[roomId].state.current =
              rooms[roomId].data.questions[currentRound + 1];

            wss.clients.forEach(function each(client) {
              if (client.readyState === WebSocket.OPEN) {
                client.send(
                  JSON.stringify({
                    ...rooms[roomId],
                    status: {
                      userId,
                      completed: true,
                    },
                  }),
                  { binary: isBinary }
                );
              }
            });
          }

          // set status to done

          // check if all clients have sent message or timer has expired

          // if false, send events to all clients with questionCompleted = false

          // else, send next question and questionCompleted = true

          return;
        default:
          console.log("defaulting...");
      }

      const isRoomPresent = parsed?.roomId && rooms[parsed.roomId];

      if (isRoomPresent) {
        roomId = parsed.roomId;

        const clients = rooms[roomId].clients;

        const isClientPresent =
          clients.filter((client) => client.id === user.id).length === 0;

        if (isClientPresent) {
          clients.push(user);
        }

        // Check if data is present
        if (!rooms[roomId].data) {
          const { data: formData, error } = await supabase
            .from("forms")
            .select("*")
            .eq("id", "7a0558a9-ce12-4d57-9b96-7288823df929")
            .single();

          if (!error) {
            rooms[roomId].data = formData;
            rooms[roomId].state.totalQuestions = formData?.questions?.length;
          }
        }

        const round = rooms[roomId].state.round;
        rooms[roomId].state.current = rooms[roomId].data.questions[round];

        wss.clients.forEach(function each(client) {
          if (client.readyState === WebSocket.OPEN) {
            client.send(
              JSON.stringify({
                ...rooms[roomId],
              }),
              { binary: isBinary }
            );
          }
        });
      } else {
        rooms[parsed.roomId] = structuredClone(EMPTY_ROOM_STATE);
      }
    } catch (e) {
      console.error(e);
    }
  });

  ws.on("close", () => {
    console.log("A client disconnected", userId);

    if (rooms[roomId]) {
      const clientIndex = rooms[roomId].clients.findIndex(
        (client) => client.id === userId
      );
      if (clientIndex > -1) {
        const transformedClient = {
          ...rooms[roomId].clients[clientIndex],
          isConnected: false,
        };
        rooms[roomId].clients.splice(clientIndex, 1, transformedClient);
      }
    }
  });
});

const authenticateUser = async (request, response, next) => {
  console.log("authenticateUser");
  try {
    const accessToken = request.cookies.access_token;

    if (!accessToken) {
      return response.status(401).json({
        code: 401,
        error: "No access token provided",
      });
    }

    const { data: user, error: authError } =
      await supabase.auth.getUser(accessToken);

    if (authError || !user) {
      return response.status(401).json({
        code: 401,
        error: "Invalid or expired token",
      });
    }

    request.user = user;
    next();
  } catch (e) {
    return response.status(500).json({
      code: 500,
      error: "Internal server error",
    });
  }
};

app.get("/", async (_, response) => {
  return response.json({ msg: "success" });
});

app.get("/api/rooms", (request, response) => {
  const roomId = request.query.id;

  if (!rooms[roomId]) {
    return response.status(400).json({ msg: false });
  }

  return response.status(200).json({ msg: true });
});

app.get("/api/auth/me", authenticateUser, (request, response) => {
  return response.status(200).json({ user: request.user });
});

// [TODO]
app.post("/api/auth/refresh", async (request, response) => {
  try {
    const refreshToken = request.cookies.refresh_token;

    if (!refreshToken) {
      return response.status(401).json({ error: "No refresh token" });
    }

    const { data, error } = await supabase.auth.refreshSession({
      refresh_token: refreshToken,
    });

    if (error || !data.session) {
      response.clearCookie("access_token");
      response.clearCookie("refresh_token");
      return response.status(401).json({ error: "Token refresh failed" });
    }

    response.cookie("access_token", data.session.access_token, {
      httpOnly: true,
      maxAge: 60 * 60 * 1000,
    });

    response.cookie("refresh_token", data.session.refresh_token, {
      httpOnly: true,
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });

    return response.status(200).json({ success: true });
  } catch (e) {
    console.error("Token refresh error", error);
    response.status(500).json({ error: "Internal server error" });
  }
});

app.post("/auth/logout", async (req, res) => {
  const refresh_token = req.cookies.refresh_token;

  if (!refresh_token) {
    return res.status(400).json({ message: "Missing refresh token" });
  }

  try {
    const { error } = await supabase.auth.signOut({
      refreshToken: refresh_token,
    });

    if (error) {
      console.error("Supabase signOut error:", error.message);
      return res.status(500).json({ message: "Logout failed" });
    }

    // Clear cookies
    res.clearCookie("access_token", {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      path: "/",
    });

    res.clearCookie("refresh_token", {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      path: "/",
    });

    return res.status(200).json({ message: "Logged out successfully" });
  } catch (e) {
    console.error("Logout error:", e);
    return res.status(500).json({ message: "Logout failed" });
  }
});

app.get("/auth/validate", (_, response) => {
  return response.status(200).json({ msg: "success" });
});

app.post("/auth/callback", (request, response) => {
  const { access_token, refresh_token } = request.body;

  if (!access_token) {
    return response.status(400).json({ msg: "No access token" });
  }

  if (!refresh_token) {
    return response.status(400).json({ msg: "No refresh token" });
  }

  response.cookie("access_token", access_token, {
    httpOnly: true,
    secure: true,
    sameSite: "none",
    path: "/",
    maxAge: DAY,
  });

  response.cookie("refresh_token", refresh_token, {
    httpOnly: true,
    secure: true,
    sameSite: "none",
    path: "/",
    maxAge: DAY,
  });

  return response.status(200).json({ msg: true });
});

app.get("/auth/verify", async (request, response) => {
  try {
    const accessToken = request.cookies.access_token;

    if (!accessToken) {
      return response.status(401).json({
        code: 401,
        error: "No access token provided",
      });
    }

    const { data, error } = await supabase.auth.getUser(accessToken);

    if (error || !data) {
      return response.status(401).json({
        code: 401,
        error: "Invalid or expired token",
      });
    }

    return response.status(200).json({ message: "success", error: null });
  } catch (e) {
    return response.status(500).json({
      code: 500,
      error: "Internal server error",
    });
  }
});

app.post("/auth/login", async (request, response) => {
  try {
    const { email } = request.body;

    if (!email) throw new Error("Email is required");

    // const { data, error } = await supabase.auth.admin.generateLink({
    //   type: "magiclink",
    //   email,
    //   options: {
    //     redirectTo: `${ORIGIN}/dashboard`,
    //   },
    // });

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${ORIGIN}/dashboard`,
      },
    });

    if (error) {
      return response.status(404).json({
        code: 404,
        message: "Unable to sign in",
      });
    }

    // const link = data.properties?.action_link;

    // const html = emailTemplate
    // .replace(
    //   "{{MAGIC_LINK}}",
    //   link
    // )
    // .replace("{{YEAR}}", new Date().getFullYear().toString());

    // await resend.emails.send({
    //   from: "support@viteform.io",
    //   to: email,
    //   subject: "Login to Viteform",
    //   html: `<p>Click here to sign in: <a href="${link}">${link}</a></p>`,
    // });

    return response.json({
      code: 201,
      message: "Email has been sent",
    });
  } catch (e) {
    return response.json({
      code: 404,
      message: "Unable to sign in",
    });
  }
});

app.get("/test/emails", async (request, response) => {
  const data = await resend.emails.send({
    from: "Login to Viteform <support@viteform.io>",
    to: "cjhroy98@gmail.com",
    subject: "Login to Viteform",
    html: "test",
  });

  return response.json({
    message: "Sent",
  });
});

app.get("/auth/google/login", async (_, response) => {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${isProduction ? "https://viteform.io" : "http://localhost:5173"}/auth/google/callback`,
    },
  });

  if (error) {
    return response.redirect("/error");
  }

  if (data.url) {
    response.status(200).json({ msg: "success", url: data.url });
  }
});

app.post("/create-checkout-session", async (_, response) => {
  const session = await stripeClient.checkout.sessions.create({
    line_items: [
      {
        price: "price_1RfPKpPxxbacjYVrkJfDxZQu",
        quantity: 1,
      },
    ],
    mode: "payment",
    success_url: `${isProduction ? "https://viteform.io" : "http://localhost:5173"}/dashboard?success=true`,
    cancel_url: `${isProduction ? "https://viteform.io" : "http://localhost:5173"}/dashboard?canceled=true`,
  });

  response.redirect(303, session.url);
});

app.get("/feedback", async (_, response) => {
  try {
    const { data, error } = await supabase.from("feedback").select("*");

    if (error) {
      return response.status(400).json({ code: 400, error, data });
    }

    return response.json({ data });
  } catch (e) {
    return response.status(500).json({
      code: 500,
      error: "Internal server error",
    });
  }
});

app.post("/feedback", async (request, response) => {
  try {
    const { data, error } = await supabase
      .from("feedback")
      .insert(request.body.data);

    if (error) {
      return response.status(400).json({ code: 400, error, data });
    }

    return response.json({ data });
  } catch (e) {
    return response.status(500).json({
      code: 500,
      error: "Internal server error",
    });
  }
});

app.post("/submit", async (request, response) => {
  try {
    let { error } = await supabase.from("responses").insert(request.body.data);

    if (!error) {
      return response.status(201).json({
        message: "Data submitted successfully",
      });
    }

    resend.emails.send({
      from: "support@viteform.io",
      to: "cjhroy98@gmail.com",
      subject: "New form submission",
      html: "<p>Congratulations! A new form submission has been made successfuly.</p>",
    });

    return response.status(500).json({
      message: "Database error occurred",
      error,
    });
  } catch (error) {
    return res.status(500).json({
      message: "An unexpected error occurred",
      error,
    });
  }
});

app.get("/responses", async (request, response) => {
  try {
    const { data: responses, error } = await supabase
      .from("responses")
      .select("*")
      .eq("formId", request.query.id);

    const results = responses.reduce((acc, response) => {
      response.questions.forEach((question) => {
        const { id, answer } = question;

        if (!acc[id]) {
          acc[id] = {};
        }

        acc[id][answer] = (acc[id][answer] || 0) + 1;
      });

      return acc;
    }, {});

    const { data: form, error: err } = await supabase
      .from("forms")
      .select("*")
      .eq("id", request.query.id)
      .single();

    const data = combineResults(form, results);

    if (!error && !err) {
      return response.status(200).json({
        message: "Successfully fetched data",
        data,
      });
    }

    return response.status(500).json({
      message: "Database fetching error",
      error: error || err,
    });
  } catch (error) {
    return response.status(500).json({
      message: "An unexpected error occurred",
      error,
    });
  }
});

app.get("/draft", async (request, response) => {
  let { data: forms, error } = await supabase
    .from("drafts")
    .select("*")
    .eq("id", request.query.id);

  if (!error) {
    return response.json({ msg: "successful", items: forms });
  }

  return response.json({ msg: "error getting form" });
});

app.post("/draft", async (request, response) => {
  try {
    let { error } = await supabase.from("drafts").upsert(request.body.data);

    if (!error) {
      return response.status(201).json({
        message: "Draft created successfully",
      });
    }

    return response.status(500).json({
      message: "An unexpected error occurred",
      error,
    });
  } catch (error) {
    return res.status(500).json({
      message: "An unexpected error occurred",
      error,
    });
  }
});

app.post("/form/create", authenticateUser, async (request, response) => {
  try {
    let { error } = await supabase.from("forms").upsert(request.body.data);

    if (!error) {
      return response.status(201).json({
        message: "Form created successfully",
      });
    }

    return response.status(500).json({
      message: "An unexpected error occurred",
      error,
    });
  } catch (error) {
    return res.status(500).json({
      message: "An unexpected error occurred",
      error,
    });
  }
});

app.put("/form", authenticateUser, async (request, response) => {
  try {
    let { error } = await supabase
      .from("forms")
      .update(request.body.data)
      .eq("id", request.body.data.id);

    if (!error) {
      return response.status(201).json({
        message: "Form updated successfully",
      });
    }

    return response.status(500).json({
      message: "An unexpected error occurred",
      error,
    });
  } catch (e) {
    return res.status(500).json({
      message: "An unexpected error occurred",
      error,
    });
  }
});

app.get("/forms/all", authenticateUser, async (request, response) => {
  let { data: forms, error } = await supabase.from("forms").select("*");

  if (!error) {
    return response.json({ msg: "successful", items: forms });
  }

  return response.json({ msg: "error getting form" });
});

app.get("/forms", async (request, response) => {
  let { data: forms, error } = await supabase
    .from("forms")
    .select("*")
    .eq("id", request.query.id);

  if (!error) {
    return response.json({ msg: "successful", items: forms });
  }

  return response.json({ msg: "error getting form" });
});

app.listen(port, () => {
  console.log(`listening on port ${port}`);
});
