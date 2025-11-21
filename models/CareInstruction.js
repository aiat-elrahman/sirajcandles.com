import mongoose from 'mongoose';

const careInstructionSchema = new mongoose.Schema({
  category: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  careTitle: {
    type: String,
    required: true,
    trim: true
  },
  careContent: {
    type: String,
    required: true
  }
}, {
  timestamps: true
});


export default mongoose.model('CareInstruction', careInstructionSchema);