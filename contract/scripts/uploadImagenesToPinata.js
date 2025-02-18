require("dotenv").config();
const axios = require("axios");
const fs = require("fs");
const FormData = require("form-data");

const PINATA_API_KEY = process.env.PINATA_API_KEY;
const PINATA_API_SECRET = process.env.PINATA_API_SECRET;
const PINATA_URL = "https://api.pinata.cloud/pinning/pinFileToIPFS";

async function uploadFileToPinata(filePath) {
  const form = new FormData();
  form.append("file", fs.createReadStream(filePath));

  try {
    const response = await axios.post(PINATA_URL, form, {
      headers: {
        "Content-Type": `multipart/form-data; boundary=${form._boundary}`,
        pinata_api_key: PINATA_API_KEY,
        pinata_secret_api_key: PINATA_API_SECRET,
      },
    });

    console.log(`Archivo "${filePath}" subido exitosamente.`);
    console.log(`CID: ${response.data.IpfsHash}`);
    return response.data.IpfsHash; // Devuelve el CID del archivo
  } catch (error) {
    console.error(`Error al subir "${filePath}" a Pinata:`, error.message);
    throw error;
  }
}

async function main() {
  const imagePaths = [".colectionNFT/assets/image1.png", ".colectionNFT/assets/image2.png"];
  const imageCIDs = [];

  for (const imagePath of imagePaths) {
    const cid = await uploadFileToPinata(imagePath);
    imageCIDs.push(cid);
  }

  console.log("Todos los archivos subidos:");
  console.log("CIDs:", imageCIDs);
}

main().catch((error) => {
  console.error("Error durante el proceso:", error);
});