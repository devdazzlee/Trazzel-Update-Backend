import mongoose from 'mongoose';
const mongodbURI = process.env.mongodbURI || "mongodb+srv://ahmedradiantcortex:ahmedradiantcortex@cluster0.sv2mcyd.mongodb.net/";
/////////////////////////////////////////////////////////////////////////////////////////////////

const userSchema = new mongoose.Schema({
  username: String,
  email: String,
  password: String,
});


const productSchema = new mongoose.Schema({
projectName:{ type: String },
projectDescription:  { type: String }, 
imageUrl: { type: Array  ,  required: true },
createdOn: { type: Date, default: Date.now },
paymentDetail :{type : Array}, 
projectPrice : {type : Number },
hardcoverPrice :{type : Number},
weight : {type :String},
width :{type :String},
height : {type : String},
});
export const tweetModel = mongoose.model('ProductsAll', productSchema);
  




const User = mongoose.model('User', userSchema);
mongoose.connect(mongodbURI);
////////////////mongodb connected disconnected events///////////////////////////////////////////////
mongoose.connection.on('connected', function () {//connected
    console.log("Mongoose is connected");
});

mongoose.connection.on('disconnected', function () {//disconnected
    console.log("Mongoose is disconnected");
    process.exit(1);
});

mongoose.connection.on('error', function (err) {//any error
    console.log('Mongoose connection error: ', err);
    process.exit(1);
});

process.on('SIGINT', function () {/////this function will run jst before app is closing
    console.log("app is terminating");
    mongoose.connection.close(function () {
        console.log('Mongoose default connection closed');
        process.exit(0);
    });
});
////////////////mongodb connected disconnected events///////////////////////////////////////////////

export default User;
