const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const ALLOWED_MIMES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

async function uploadAvatar(fileBuffer, mimetype, userId) {
  if (!ALLOWED_MIMES.includes(mimetype)) {
    throw Object.assign(new Error('Carl only allows photos. No documents at the bar.'), { code: 'INVALID_MIME' });
  }
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: 'maclaren/avatars', public_id: `avatar_${userId}`, overwrite: true },
      (err, result) => err ? reject(err) : resolve(result.secure_url)
    );
    stream.end(fileBuffer);
  });
}

module.exports = { uploadAvatar, ALLOWED_MIMES };
