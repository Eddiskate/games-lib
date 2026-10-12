import bcrypt from 'bcryptjs';
import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { requireAuth } from './middleware.js';
import { User } from './models.js';

export const authRouter = Router();

function publicUser(user) {
  return { id: user.id, name: user.name, email: user.email };
}

function sign(user) {
  const token = jwt.sign({ sub: user.id }, process.env.JWT_SECRET, { expiresIn: '7d' });
  return { token, user: publicUser(user) };
}

authRouter.post('/register', async (req, res) => {
  const name = String(req.body.name || '').trim();
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');

  if (!name || !email || password.length < 6) {
    return res.status(400).json({ message: 'Podaj imię, e-mail i hasło (min. 6 znaków).' });
  }
  if (await User.exists({ email })) {
    return res.status(409).json({ message: 'Konto z tym e-mailem już istnieje.' });
  }

  const user = await User.create({
    name,
    email,
    passwordHash: await bcrypt.hash(password, 10),
  });
  res.status(201).json(sign(user));
});

authRouter.post('/login', async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  const user = await User.findOne({ email });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return res.status(401).json({ message: 'Nieprawidłowy e-mail lub hasło.' });
  }
  res.json(sign(user));
});

authRouter.get('/me', requireAuth, async (req, res) => {
  const user = await User.findById(req.userId);
  if (!user) return res.status(401).json({ message: 'Zaloguj się.' });
  res.json(publicUser(user));
});
