import { v2 as cloudinary, UploadApiResponse } from "cloudinary";
import httpStatus from "http-status-codes";
import stream from "stream";
import AppError from "../errorHelpers/AppError";
import env from "./env.config";

cloudinary.config({
  cloud_name: env.CLOUDINARY_CLOUD_NAME,
  api_key: env.CLOUDINARY_API_KEY,
  api_secret: env.CLOUDINARY_API_SECRET,
});

export const uploadBufferToCloudinary = async (
  buffer: Buffer,
  fileName: string,
  folder: string, // avatar | documents | others
): Promise<UploadApiResponse | undefined> => {
  try {
    return new Promise((resolve, reject) => {
      const public_id = `${fileName}-${Date.now()}`;

      const bufferStream = new stream.PassThrough();
      bufferStream.end(buffer);

      cloudinary.uploader
        .upload_stream(
          {
            resource_type: "auto",
            public_id: public_id,
            folder: `payWallet/${folder}`,
          },
          (error, result) => {
            if (error) {
              return reject(error);
            }
            resolve(result);
          },
        )
        .end(buffer);
    });
  } catch (error: any) {
    throw new AppError(
      httpStatus.UNAUTHORIZED,
      `Error uploading file ${error.message}`,
    );
  }
};

export const deleteImageFromCLoudinary = async (url: string) => {
  try {
    const regex = /\/v\d+\/(.*?)\.(jpg|jpeg|png|gif|webp)$/i;

    const match = url.match(regex);

    if (match && match[1]) {
      const public_id = match[1];
      await cloudinary.uploader.destroy(public_id);
    }
  } catch (error: any) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Cloudinary image deletion failed",
      error.message,
    );
  }
};

export const cloudinaryUpload = cloudinary;
