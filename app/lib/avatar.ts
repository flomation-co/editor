// Avatars are stored as data URLs on the record itself, so what the
// browser uploads is what every later page load carries. A phone camera
// photo is several megabytes; sending one verbatim would bloat every
// list response that includes the record. So the image is decoded,
// cropped square and redrawn small here, and only the result is sent.

export const AVATAR_SIZE = 128;

export class AvatarError extends Error {}

/**
 * Reads an image file and returns a square data URL of AVATAR_SIZE.
 *
 * The centre of the image is kept: a portrait cropped to its middle is
 * almost always the subject, whereas scaling the whole thing into a
 * square would distort it.
 */
export async function fileToAvatarDataURL(file: File): Promise<string> {
    if (!file.type.startsWith("image/")) {
        throw new AvatarError("Choose an image file.");
    }
    // SVG is refused by the API — it is a document that can carry
    // script — so say so here rather than after a round trip.
    if (file.type === "image/svg+xml") {
        throw new AvatarError("SVG images can't be used as avatars. Try a PNG, JPEG or WebP.");
    }

    const bitmap = await loadImage(file);

    const canvas = document.createElement("canvas");
    canvas.width = AVATAR_SIZE;
    canvas.height = AVATAR_SIZE;
    const context = canvas.getContext("2d");
    if (!context) {
        throw new AvatarError("This browser can't process the image.");
    }

    const side = Math.min(bitmap.width, bitmap.height);
    const sx = (bitmap.width - side) / 2;
    const sy = (bitmap.height - side) / 2;
    context.drawImage(bitmap, sx, sy, side, side, 0, 0, AVATAR_SIZE, AVATAR_SIZE);

    // A browser without WebP encoding returns a PNG data URL, correctly
    // labelled, which the API accepts — so there is nothing to detect.
    return canvas.toDataURL("image/webp", 0.85);
}

function loadImage(file: File): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file);
        const image = new Image();
        image.onload = () => {
            URL.revokeObjectURL(url);
            resolve(image);
        };
        image.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new AvatarError("That image couldn't be read."));
        };
        image.src = url;
    });
}
