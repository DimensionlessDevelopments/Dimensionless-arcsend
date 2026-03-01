import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { randomBytes } from 'node:crypto';
import { verifyMessage } from 'ethers';
import { z } from 'zod';
import { db } from '../db.js';
import { config } from '../config.js';

const authSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6)
});

const walletAddressSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid wallet address')
  .transform((value) => value.toLowerCase());

const walletChallengeSchema = z.object({
  address: walletAddressSchema
});

const walletVerifySchema = z.object({
  address: walletAddressSchema,
  message: z.string().min(1),
  signature: z.string().min(1)
});

const challengeStore = new Map();
const CHALLENGE_TTL_MS = 5 * 60 * 1000;

function walletEmailFromAddress(address) {
  return `wallet+${address.slice(2)}@arcsend.local`;
}

function buildChallengeMessage(address, nonce) {
  return [
    'ArcSend Wallet Login',
    '',
    `Address: ${address}`,
    `Nonce: ${nonce}`,
    'Sign this message to authenticate with ArcSend.',
    'No blockchain transaction or gas fee is required.'
  ].join('\n');
}

function signToken(user) {
  return jwt.sign({ userId: user.id, email: user.email }, config.jwtSecret, { expiresIn: '7d' });
}

export async function signup(req, res) {
  try {
    const input = authSchema.parse(req.body);
    const existing = await db.user.findUnique({ where: { email: input.email } });

    if (existing) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const passwordHash = await bcrypt.hash(input.password, 10);
    const user = await db.user.create({
      data: {
        email: input.email,
        passwordHash
      }
    });

    return res.status(201).json({ token: signToken(user), user: { id: user.id, email: user.email } });
  } catch (error) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: error.errors });
    }
    return res.status(500).json({ error: 'Signup failed' });
  }
}

export async function login(req, res) {
  try {
    const input = authSchema.parse(req.body);
    const user = await db.user.findUnique({ where: { email: input.email } });

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isValid = await bcrypt.compare(input.password, user.passwordHash);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    return res.json({ token: signToken(user), user: { id: user.id, email: user.email } });
  } catch (error) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: error.errors });
    }
    return res.status(500).json({ error: 'Login failed' });
  }
}

export async function walletChallenge(req, res) {
  try {
    const input = walletChallengeSchema.parse(req.body);
    const nonce = randomBytes(16).toString('hex');
    const expiresAt = Date.now() + CHALLENGE_TTL_MS;
    challengeStore.set(input.address, { nonce, expiresAt });

    return res.json({
      address: input.address,
      message: buildChallengeMessage(input.address, nonce),
      expiresAt
    });
  } catch (error) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: error.errors });
    }
    return res.status(500).json({ error: 'Failed to create wallet challenge' });
  }
}

export async function walletVerify(req, res) {
  try {
    const input = walletVerifySchema.parse(req.body);
    const challenge = challengeStore.get(input.address);

    if (!challenge || challenge.expiresAt < Date.now()) {
      challengeStore.delete(input.address);
      return res.status(401).json({ error: 'Challenge expired or missing. Please retry wallet login.' });
    }

    const expectedMessage = buildChallengeMessage(input.address, challenge.nonce);
    if (input.message !== expectedMessage) {
      challengeStore.delete(input.address);
      return res.status(401).json({ error: 'Challenge message mismatch. Please retry wallet login.' });
    }

    const recoveredAddress = verifyMessage(input.message, input.signature).toLowerCase();
    if (recoveredAddress !== input.address) {
      challengeStore.delete(input.address);
      return res.status(401).json({ error: 'Signature verification failed.' });
    }

    challengeStore.delete(input.address);

    const walletEmail = walletEmailFromAddress(input.address);
    let user = await db.user.findUnique({ where: { email: walletEmail } });

    if (!user) {
      const passwordHash = await bcrypt.hash(randomBytes(32).toString('hex'), 10);
      user = await db.user.create({
        data: {
          email: walletEmail,
          passwordHash
        }
      });
    }

    return res.json({
      token: signToken(user),
      user: {
        id: user.id,
        email: user.email,
        walletAddress: input.address
      }
    });
  } catch (error) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: error.errors });
    }
    return res.status(500).json({ error: 'Wallet login failed' });
  }
}
