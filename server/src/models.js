import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
}, { timestamps: true });

const gameSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  barcode: { type: String, default: '' },
  title: { type: String, required: true },
  description: { type: String, default: '' },
  coverUrl: { type: String, default: '' },
  released: { type: String, default: '' },
  platforms: { type: [String], default: [] },
  genres: { type: [String], default: [] },
  rating: { type: Number, default: null },
  source: { type: String, default: 'manual' },
  externalId: { type: String, default: '' },
}, { timestamps: true });

const catalogSchema = new mongoose.Schema({
  barcode: { type: String, required: true, unique: true },
  candidates: { type: Array, default: [] },
}, { timestamps: true });

export const User = mongoose.model('User', userSchema);
export const Game = mongoose.model('Game', gameSchema);
export const Catalog = mongoose.model('Catalog', catalogSchema);
