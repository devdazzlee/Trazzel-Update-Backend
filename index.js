import express from "express";
const app = express();
const port = process.env.PORT || 8000; // Use process.env.PORT for flexibility
import cors from "cors";
import multer from "multer";
import bucket from "./Bucket/Firebase.js";
import fs from "fs";
import { tweetModel } from "./Models/User.js";
import { Client, Environment } from 'square';
import { randomUUID } from "crypto";
import bodyParser from 'body-parser';
import nodemailer from 'nodemailer';

app.use(express.json());
app.use(cors());
app.options('*', cors()); // CORS for all routes

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'ahmed.radiantcortex@gmail.com',
    pass: 'mreljejirzhndetb',
  },
});

const storage = multer.diskStorage({
  destination: "/tmp",
  filename: function (req, file, cb) {
    console.log("mul-file: ", file);
    cb(null, `${new Date().getTime()}-${file.originalname}`);
  },
});
const upload = multer({ storage });

const { paymentsApi } = new Client({
  accessToken: process.env.SQUARE_ACCESS_TOKEN,
  environment : Environment.Sandbox,
});
// Custom JSON replacer function to handle BigInt
const jsonReplacer = (key, value) => {
  return typeof value === 'bigint' ? value.toString() : value;
};


app.get('/', (req, res) => {
  res.send("Trazzel Server Running");
});

// Email Api 
app.post('/api/messages', async (req, res) => {
  const { name, email, phoneNumber, callTime, description, agreeToContact } = req.body;

  const mailOptions = {
    from: 'ahmed.radiantcortex@gmail.com',
    to: 'ahmed.gpt.1998@gmail.com',
    subject: 'New Contact Form Submission',
    html: `
      <h1>New Contact Form Submission</h1>
      <p><strong>Name:</strong> ${name}</p>
      <p><strong>Email:</strong> ${email}</p>
      <p><strong>Phone Number:</strong> ${phoneNumber}</p>
      <p><strong>Preferred Call Time:</strong> ${callTime}</p>
      <p><strong>Description:</strong> ${description}</p>
      <p><strong>Agree to Contact:</strong> ${agreeToContact ? 'Yes' : 'No'}</p>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    res.status(200).send({ message: 'Form submitted and email sent successfully!' });
  } catch (error) {
    console.error('Error sending email:', error);
    res.status(500).send({ message: 'Error sending email', error });
  }
});

app.post('/process-payment', async (req, res) => {
  const { sourceId, amount, productDetail, clientEmail, deliveryDetails } = req.body;
  console.log(clientEmail);
  console.log("Product Detail", productDetail);
  console.log("Delivery Details", deliveryDetails);

  try {
    const amountInCents = Math.round(amount * 100);
    const { result } = await paymentsApi.createPayment({
      idempotencyKey: randomUUID(),
      sourceId,
      amountMoney: {
        currency: 'USD',
        amount: amountInCents,
      },
      note: JSON.stringify(productDetail),
      buyerEmail: clientEmail, // Pass client email to Square payment API
    });

    console.log(result);

    // Fetch product details from the database
    const productIds = productDetail.map(item => item.id);
    const products = await tweetModel.find({ _id: { $in: productIds } });

    // Prepare product details for email
    let productInfo = '';
    products.forEach(product => {
      const quantity = productDetail.find(item => item.id === product._id.toString()).quantity;
      productInfo += `<p><strong>Product:</strong> ${product.projectName}<br><strong>Quantity:</strong> ${quantity}<br><strong>Price:</strong> ${product.projectPrice}</p>`;
    });

    // Format delivery details for email
    const deliveryInfo = `
      <p><strong>Delivery Information:</strong></p>
      <p>Country/Region: ${deliveryDetails.country}</p>
      <p>First Name: ${deliveryDetails.firstName}</p>
      <p>Last Name: ${deliveryDetails.lastName}</p>
      <p>Address: ${deliveryDetails.address}</p>
      <p>Apartment, Suite, etc.: ${deliveryDetails.apartment}</p>
      <p>City: ${deliveryDetails.city}</p>
      <p>State: ${deliveryDetails.state}</p>
      <p>ZIP Code: ${deliveryDetails.zipCode}</p>
    `;

    const clientMailOptions = {
      from: 'ahmed.radiantcortex@gmail.com',
      to: clientEmail,
      subject: 'Your Order Confirmation',
      html: `
        <html>
          <head>
            <style>
              body {
                font-family: Arial, sans-serif;
                background-color: #f4f4f4;
                color: #333;
              }

              .container {
                max-width: 600px;
                margin: 0 auto;
                padding: 20px;
                background-color: #fff;
                border-radius: 8px;
                box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
              }

              h1 {
                color: #007BFF;
              }

              p {
                line-height: 1.6;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <h1>Thank You for Your Purchase!</h1>
              <h2>Order Details:</h2>
              ${productInfo}
              <p>Total Amount: USD ${amount}</p>
              ${deliveryInfo}
            </div>
          </body>
        </html>
      `,
    };

    const ownerMailOptions = {
      from: 'ahmed.radiantcortex@gmail.com',
      to: 'stargatemediallc@gmail.com',
      subject: 'New Order Received',
      html: `
        <html>
          <head>
            <style>
              body {
                font-family: Arial, sans-serif;
                background-color: #f4f4f4;
                color: #333;
              }

              .container {
                max-width: 600px;
                margin: 0 auto;
                padding: 20px;
                background-color: #fff;
                border-radius: 8px;
                box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
              }

              h1 {
                color: #007BFF;
              }

              p {
                line-height: 1.6;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <h1>New Order Received</h1>
              <h2>Order Details:</h2>
              ${productInfo}
              <p>Total Amount: USD ${amount}</p>
              <p><strong>Client Email:</strong> ${clientEmail}</p>
              ${deliveryInfo}
            </div>
          </body>
        </html>
      `,
    };

    // Send emails
    await transporter.sendMail(clientMailOptions);
    await transporter.sendMail(ownerMailOptions);

    const stringifiedResult = JSON.stringify(result, jsonReplacer);
    res.status(200).json(JSON.parse(stringifiedResult));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

// Important Api
app.get("/api/v1/products", async (req, res) => {
  try {
    const result = await tweetModel.find().exec(); // Using .exec() to execute the query
    // console.log(result);
    res.send({
      message: "Got all Books successfully",
      data: result,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send({
      message: "Server error",
    });
  }
});

app.get("/api/v1/CompletedProject24/:id", upload.any(), async (req, res) => {
  const id = req.params.id;

  try {
    // Assuming tweetModel has a method like findById to find a document by its ID
    const tweet = await tweetModel.findById(id);

    if (!tweet) {
      return res.status(404).json({ error: "Tweet not found" });
    }
    res.send(tweet);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.post("/api/v1/AddProduct", upload.any(), (req, res) => {
  try {
    const body = req.body;
    console.log(body.projectName);
    console.log();

    console.log("req.body: ", req.body);
    console.log("req.files: ", req.files);

    const uploadedFiles = req.files.map((file) => {
      console.log("uploaded file name: ", file.originalname);
      console.log("file type: ", file.mimetype);
      console.log("file name in server folders: ", file.filename);
      console.log("file path in server folders: ", file.path);

      return new Promise((resolve, reject) => {
        bucket.upload(
          file.path,
          {
            destination: `tweetPictures/${file.filename}`,
          },
          (err, gcsFile) => {
            if (!err) {
              gcsFile
                .getSignedUrl({
                  action: "read",
                  expires: "03-09-2999",
                })
                .then((urlData) => {
                  console.log("public downloadable url: ", urlData[0]);
                  fs.unlinkSync(file.path); // Delete the local file

                  resolve(urlData[0]);
                })
                .catch((err) => {
                  console.error("Error getting signed URL:", err);
                  reject(err);
                });
            } else {
              console.error("Error uploading to GCS:", err);
              reject(err);
            }
          }
        );
      });
    });

    Promise.all(uploadedFiles)
      .then((urls) => {
        let array = urls;
        let addProduct = new tweetModel({
          projectName: body.projectName,
          projectDescription: body.projectDescription,
          imageUrl: array,
          projectPrice : body.projectPrice
        });

        return addProduct.save();
      })
      .then(() => {
        console.log("Product added successfully");
        res.status(200).send();
      })
      .catch((error) => {
        console.error("Error adding product:", error);
        res.status(500).send();
      });
  } catch (error) {
    console.log("error: ", error);
    res.status(500).send();
  }
});

app.delete("/api/v1/customer/:id", async (req, res) => {
  const id = req.params.id;

  try {
    const deletedData = await tweetModel.deleteOne({ _id: id });

    if (deletedData.deletedCount !== 0) {
      res.send({
        message: "Product has been deleted successfully",
      });
    } else {
      res.status(404).send({
        message: "No Product found with this id: " + id,
      });
    }
  } catch (err) {
    res.status(500).send({
      message: "Server error",
    });
  }
});

app.post("/api/v1/updates/:id", upload.any(), async (req, res) => {
  try {
    const body = req.body;
    const id = req.params.id;
    console.log("req.body: ", req.body);
    console.log("req.files: ", req.files);

    const uploadedFiles = req.files.map((file) => {
      console.log("uploaded file name: ", file.originalname);
      console.log("file type: ", file.mimetype);
      console.log("file name in server folders: ", file.filename);
      console.log("file path in server folders: ", file.path);

      return new Promise((resolve, reject) => {
        bucket.upload(
          file.path,
          {
            destination: `tweetPictures/${file.filename}`,
          },
          (err, gcsFile) => {
            if (!err) {
              gcsFile
                .getSignedUrl({
                  action: "read",
                  expires: "03-09-2999",
                })
                .then((urlData) => {
                  console.log("public downloadable url: ", urlData[0]);
                  fs.unlinkSync(file.path); // Delete the local file

                  resolve(urlData[0]);
                })
                .catch((err) => {
                  console.error("Error getting signed URL:", err);
                  reject(err);
                });
            } else {
              console.error("Error uploading to GCS:", err);
              reject(err);
            }
          }
        );
      });
    });

    Promise.all(uploadedFiles).then((urls) => {
      let array = urls;
      tweetModel
        .findByIdAndUpdate(
          id,
          {
            projectName: body.projectName,
            projectDescription: body.projectDescription,
            imageUrl: array,
          },
          { new: true }
        )
        .then((updatedProduct) => {
          console.log("Product Updated successfully", updatedProduct);
          res.status(200).send();
        })
        .catch((error) => {
          console.error("Error updating product:", error);
          res.status(500).send();
        });
    });
  } catch (error) {
    console.log("error: ", error);
    res.status(500).send();
  }
});

app.get('/api/v1/Book-detail/:id', async (req, res) => {
  const id = req.params.id;

  try {
    // Assuming tweetModel has a method like findById to find a document by its ID
    const book = await tweetModel.findById(id);
    if (!book) {
      return res.send(404).json({ error: "Book not found" });
    }
    res.status(200).json(book); // Return the book object if found
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Book not found" });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
