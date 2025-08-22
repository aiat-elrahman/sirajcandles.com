require('dotenv').config(); // <-- MUST be first
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

console.log('Mongo URI is:', process.env.MONGO_URI); // <-- debug lin
app.use(cors());
const app = express();
app.use(express.json());

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

app.get('/', (req, res) => {
  res.send('SirajCandles backend is running...');
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
const productRoutes = require('./routes/products');
app.use('/api/products', productRoutes);