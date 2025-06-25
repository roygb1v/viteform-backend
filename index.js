import "dotenv/config";
import express from "express";
import WebSocket, { WebSocketServer } from "ws";
import cookieParser from "cookie-parser";
import cors from "cors";
import { createClient } from "@supabase/supabase-js";
import { combineResults } from "./utils/index.js";
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);
const app = express();
const port = 3000;
const isProduction = process.env.NODE_ENV === "production";
const ORIGIN = isProduction ? "https://viteform.io" : "http://localhost:5173";
app.use(express.json());
app.use(cookieParser());
// app.use(cors({ credentials: true, origin: ORIGIN })); // dont use this in production

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
          console.log("responding...");
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
  console.log("authenticateUser cookies: ", request.cookies);
  try {
    const accessToken = request.cookies.access_token;

    if (!accessToken) {
      return response.status(401).json({
        code: 401,
        error: "No access token provided",
      });
    }

    const { data: user, error: authError } = await supabase.auth.getUser(
      accessToken
    );

    console.log(user, authError);

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
    console.log("cookies", request.cookies);
    console.log("refreshToken", refreshToken);

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
    maxAge: 60 * 60 * 1000,
  });

  response.cookie("refresh_token", refresh_token, {
    httpOnly: true,
    secure: true,
    sameSite: "none",
    path: "/",
    maxAge: 60 * 60 * 1000,
  });

  return response.status(200).json({ msg: true });
});

app.post("/auth/login", async (request, response) => {
  try {
    const { email } = request.body;

    if (!email) throw new Error("Email is required");

    const { data, error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${ORIGIN}/dashboard`,
      },
    });

    if (error) {
      return response.json({
        code: 404,
        message: "Unable to sign in",
      });
    }

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

app.get("/auth/google/login", async (_, response) => {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${isProduction ? "https://viteform.io" : "http://localhost:5173"}/auth/google/callback`,
    },
  });

  if (error) {
    return response.redirect("/error")
  }

  if (data.url) {
    response.status(200).json({msg: "success", url: data.url})
  }
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

app.post("/submit", async (request, response) => {
  try {
    let { error } = await supabase.from("responses").insert(request.body.data);

    if (!error) {
      return response.status(201).json({
        message: "Data submitted successfully",
      });
    }

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

app.post("/form/create", authenticateUser, async (request, response) => {
  try {
    let { error } = await supabase.from("forms").insert(request.body.data);

    if (!error) {
      return response.status(201).json({
        message: "Form created successfully",
      });
    }

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
