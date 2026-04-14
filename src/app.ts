import cors from "cors";
import express, { Request, Response } from "express";
import expressSession from "express-session";
import helmet from "helmet";
import morgan from "morgan";
import passport from "passport";
import { env } from "./config/env";
import "./config/passport";
import globalErrorHandler from "./middlewares/globalErrorHandler";
import notFound from "./middlewares/notFound";
import { router } from "./routes";

const app = express();

app.use(
  expressSession({
    secret: env.EXPRESS_SESSION_SECRET as string,
    resave: false,
    saveUninitialized: false,
  }),
);
app.use(express.json());
app.use(cors());
app.use(helmet());
app.use(morgan("dev"));
app.use(passport.initialize());
app.use(passport.session());

app.use("/api/v1", router);

app.get("/", (req: Request, res: Response) => {
  res.send("Welcome to the Wallet System Application!");
});

app.use(globalErrorHandler);
app.use(notFound);

export default app;
