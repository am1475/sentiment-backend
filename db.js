const mongoose=require('mongoose');

const product=mongoose.Schema(
    {
        name:String,
        feedback:String,
        rating:Number,
    }
    
);

const productdb=mongoose.model("product2",product)
module.exports=productdb;