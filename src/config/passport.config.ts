import passport from "passport";
import {
  Strategy as GoogleStrategy,
  Profile,
  VerifyCallback,
} from "passport-google-oauth20";

import mongoose from "mongoose";

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
        const session = await mongoose.startSession();

        try {
          session.startTransaction();

          const email = profile.emails?.[0]?.value?.toLowerCase();

          if (!email) {
            await session.abortTransaction();
            return done(null, false, { message: "No Email Found!" });
          }

          let isUserExist = await User.findOne({ email }).session(session);

          // blocked user
          if (isUserExist && isUserExist.isBlocked) {
            await session.abortTransaction();
            return done(null, false, { message: "User is blocked" });
          }

          // user not exist → create
          if (!isUserExist) {
            const createdUser = await User.create(
              [
                {
                  email,
                  name: profile.displayName,
                  // picture: profile.photos?.[0]?.value,
                  role: Role.USER,
                  auths: [
                    {
                      provider: "google",
                      providerId: profile.id,
                    },
                  ],
                },
              ],
              { session },
            );

            isUserExist = createdUser[0];

            // create wallet
            await Wallet.create(
              [
                {
                  userId: isUserExist._id,
                },
              ],
              { session },
            );
          }

          // user exist but google not linked
          else {
            const hasGoogleAuth = isUserExist.auths?.some(
              (auth) => auth.provider === "google",
            );

            if (!hasGoogleAuth) {
              isUserExist.auths.push({
                provider: "google",
                providerId: profile.id,
              });

              await isUserExist.save({ session });
            }
          }

          await session.commitTransaction();

          return done(null, isUserExist);
        } catch (error) {
          await session.abortTransaction();
          return done(error as any);
        } finally {
          session.endSession();
        }
      },
    ),
  );
} else {
  console.warn(
    "Google OAuth disabled. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_CALLBACK_URL to enable it.",
  );
}

// serialize user
passport.serializeUser((user: any, done: (err: any, id?: unknown) => void) => {
  done(null, user._id.toString());
});

// deserialize user
passport.deserializeUser(async (id: string, done: any) => {
  try {
    const user = await User.findById(id).lean();

    if (!user) {
      return done(null, false);
    }

    done(null, user);
  } catch (error) {
    done(error);
  }
});
