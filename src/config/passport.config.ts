import passport from "passport";
import {
  Strategy as GoogleStrategy,
  Profile,
  VerifyCallback,
} from "passport-google-oauth20";

import { User } from "../modules/auth/auth.model";
import { Role } from "../modules/auth/auth.types";
import { Wallet } from "../modules/wallet/wallet.model";
import env from "./env.config";

export const isGoogleOAuthConfigured = Boolean(
  env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET && env.GOOGLE_CALLBACK_URL,
);

// google authentication
if (isGoogleOAuthConfigured) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: env.GOOGLE_CLIENT_ID as string,
        clientSecret: env.GOOGLE_CLIENT_SECRET as string,
        callbackURL: env.GOOGLE_CALLBACK_URL as string,
      },
      async (
        _accessToken: string,
        _refreshToken: string,
        profile: Profile,
        done: VerifyCallback,
      ) => {
        try {
          const email = profile.emails?.[0].value;
          if (!email) {
            return done(null, false, { message: "No Email Found!" });
          }
          let isUserExist = await User.findOne({ email });
          if (isUserExist && isUserExist.isBlocked) {
            return done(null, false, { message: "User is blocked" });
          }

          if (!isUserExist) {
            isUserExist = await User.create({
              email,
              name: profile.displayName,
              // picture: profile.photos?.[0].value,
              role: Role.USER,

              auths: [
                {
                  provider: "google",
                  providerId: profile.id,
                },
              ],
            });
            // create wallet automatically
            await Wallet.create({
              userId: isUserExist._id,
            });
          }

          return done(null, isUserExist);
        } catch (error) {
          return done(error);
        }
      },
    ),
  );
} else {
  console.warn(
    "Google OAuth disabled. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_CALLBACK_URL to enable it.",
  );
}

passport.serializeUser((user: any, done: (err: any, id?: unknown) => void) => {
  done(null, user._id);
});

passport.deserializeUser(async (id: string, done: any) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (error) {
    done(error);
  }
});
