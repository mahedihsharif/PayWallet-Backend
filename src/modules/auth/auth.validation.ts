import { z } from "zod";

export const registerSchema = z.object({
  name: z.string().optional(),
  email: z
    .string({ message: "Invalid email address format." })
    .nonempty("Email is required!")
    .min(5, { message: "Email must be at least 5 characters long." })
    .max(100, { message: "Email cannot exceed 100 characters." }),
  phone: z
    .string()
    .nonempty("Phone is required")
    .regex(/^(?:\+?880|0)1[3-9]\d{8}$/, {
      message:
        "Phone number must be valid for Bangladesh. Format: +8801XXXXXXXXX or 01XXXXXXXXX",
    }),
  password: z
    .string()
    .nonempty("Password is required!")
    .min(8, { message: "Password must be at least 8 characters long." })
    .regex(/^(?=.*[A-Z])/, {
      message: "Password must contain at least 1 uppercase character.",
    })
    .regex(/^(?=.*[a-z])/, {
      message: "Password must contain at least 1 lowercase character.",
    })
    .regex(/^(?=.*\d)/, {
      message: "Password must contain at least 1 number.",
    })
    .regex(/^(?=.*[!@#$%^&*])/, {
      message: "Password must contain at least 1 special character.",
    }),
});

export const loginSchema = z.object({
  email: z
    .string({ message: "Invalid email address format." })
    .nonempty("Email is required!")
    .min(5, { message: "Email must be at least 5 characters long." })
    .max(100, { message: "Email cannot exceed 100 characters." }),
  password: z
    .string()
    .nonempty("Password is required!")
    .min(8, { message: "Password must be at least 8 characters long." })
    .regex(/^(?=.*[A-Z])/, {
      message: "Password must contain at least 1 uppercase character.",
    })
    .regex(/^(?=.*[a-z])/, {
      message: "Password must contain at least 1 lowercase character.",
    })
    .regex(/^(?=.*\d)/, {
      message: "Password must contain at least 1 number.",
    })
    .regex(/^(?=.*[!@#$%^&*])/, {
      message: "Password must contain at least 1 special character.",
    }),
});
