import "dotenv/config";
import express from "express";
import WebSocket, { WebSocketServer } from "ws";
import cookieParser from "cookie-parser";
import cors from "cors";
import { createClient } from "@supabase/supabase-js";
import { combineResults } from "./utils/index.js";
const supabaseUrl = "https://nnasgslpoyasulvyovov.supabase.co";
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const app = express();
const port = 3000;

app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
  })
);
app.use(cookieParser());
app.use(express.json());

const wss = new WebSocketServer({ port: 8080 });

wss.on("connection", (ws) => {
  ws.on("error", console.error);

  const intervalId = setInterval(() => {
    const data = {
      timestamp: Date.now(),
      temperature: Math.random() * 100,
      humidity: Math.random() * 50,
    };

    ws.send(JSON.stringify(data));
  }, 1000);

  ws.on("message", (data, isBinary) => {
    const msg = data.toString();

    wss.clients.forEach(function each(client) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data, { binary: isBinary });
      }
    });
  });

  ws.on("close", () => {
    console.log("A client disconnected");
    clearInterval(intervalId);
  });
});

const authenticateUser = async (request, response, next) => {
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

app.get("/api/auth/me", authenticateUser, (request, response) => {
  return response.status(200).json({ user: request.user });
});

app.get("/tester", authenticateUser, (_, response) => {
  return response.json({ msg: "success" });
});

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

app.post("/auth/login", async (request, response) => {
  try {
    const { email } = request.body;

    if (!email) throw new Error("Email is required");

    const { data, error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: "http://localhost:5173/dashboard",
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

app.get("/auth/google/callback", async (request, response) => {
  try {
    const token = request.query.access_token;

    response.redirect("http://localhost:5173/dashboard");
  } catch (e) {
    response.redirect("http://localhost:5173/error");
  }
});

app.get("/test", authenticateUser, async (_, response) => {
  try {
    const { data, error } = await supabase.from("test").select("*");

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

app.get("/forms/all", authenticateUser, async (request, response) => {
  let { data: forms, error } = await supabase.from("forms").select("*");

  if (!error) {
    return response.json({ msg: "successful", items: forms });
  }

  return response.json({ msg: "error getting form" });
});

app.get("/forms", authenticateUser, async (request, response) => {
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
