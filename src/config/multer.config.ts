import multer from "multer";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import { cloudinaryUpload } from "./cloudinary.config";

const storage = new CloudinaryStorage({
  cloudinary: cloudinaryUpload,
  params: async (req, file) => {
    const fileName = file.originalname
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/\./g, "-")
      .replace(/[^a-z0-9\-\.]/g, "");

    const extension = file.originalname.split(".").pop();

    const uniqueFileName =
      Math.random().toString(36).substring(2) +
      "-" +
      Date.now() +
      "-" +
      fileName +
      "." +
      extension;

    //IMPORTANT: dynamic folder logic
    let folder = "payWallet/others";

    if (req.route?.path?.includes("avatar")) {
      folder = "payWallet/avatars";
    } else if (req.route?.path?.includes("document")) {
      folder = "payWallet/documents";
    }

    return {
      folder,
      public_id: uniqueFileName,
      resource_type: "image",
    };
  },
});

export const multerUpload = multer({ storage: storage });
