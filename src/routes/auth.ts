import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { ethers } from 'ethers';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import prisma from '../config/db';
import { Prisma } from '@prisma/client';
import { env } from '../config/env';
import { authMiddleware } from '../middleware/auth';

// ─── Secret Key Generation ──────────────────────────────────
// Generate a 12-word recovery phrase (BIP39-like)
const WORDLIST = [
  'abandon','ability','able','about','above','absent','absorb','abstract','absurd','abuse',
  'access','accident','account','accuse','achieve','acid','acoustic','acquire','across','act',
  'action','actor','actress','actual','adapt','add','address','adjust','admit','adult',
  'advance','advice','aerobic','affair','afford','afraid','again','age','agent','agree',
  'ahead','aim','air','airport','aisle','alarm','album','alcohol','alert','alien',
  'all','alley','allow','almost','alone','alpha','already','also','alter','always',
  'amateur','amazing','among','amount','amused','analyst','anchor','ancient','anger','angle',
  'animal','ankle','announce','annual','another','answer','antenna','antique','anxiety','any',
  'apart','apology','appear','apple','approve','april','arch','arctic','area','arena',
  'argue','arm','armed','armor','army','around','arrange','arrest','arrive','arrow',
  'art','artefact','artist','artwork','ask','aspect','assault','asset','assist','assume',
  'asthma','athlete','atom','attack','attend','attitude','attract','auction','audit','august',
  'aunt','author','auto','autumn','average','avocado','avoid','awake','aware','awesome',
  'awful','awkward','axis','baby','bachelor','bacon','badge','bag','balance','balcony',
  'ball','bamboo','banana','banner','bar','barely','bargain','barrel','base','basic',
  'basket','battle','beach','bean','beauty','because','become','beef','before','begin',
  'behave','behind','believe','below','belt','bench','benefit','best','betray','better',
  'between','beyond','bicycle','bid','bike','bind','biology','bird','birth','bitter',
  'black','blade','blame','blanket','blast','bleak','bless','blind','blood','blossom',
  'blow','blue','blur','blush','board','boat','body','boil','bomb','bone',
  'bonus','book','boost','border','boring','borrow','boss','bottom','bounce','box',
  'boy','bracket','brain','brand','brave','bread','breeze','brick','bridge','brief',
  'bright','bring','brisk','broad','broccoli','broken','bronze','broom','brother','brown',
  'brush','bubble','buddy','budget','buffalo','build','bulb','bulk','bullet','bundle',
  'bunny','burden','burger','burst','bus','business','busy','butter','buyer','buzz',
  'cabbage','cabin','cable','cactus','cage','cake','call','calm','camera','camp',
  'canal','cancel','candy','cannon','canoe','canvas','canyon','capable','capital','captain',
  'car','carbon','card','cargo','carpet','carry','cart','case','cash','casino',
  'castle','casual','cat','catalog','catch','category','cattle','caught','cause','caution',
  'cave','ceiling','celery','cement','census','century','cereal','certain','chair','chalk',
  'champion','change','chaos','chapter','charge','chase','cheap','check','cheese','chef',
  'cherry','chest','chicken','chief','child','chimney','choice','choose','chronic','chunk',
  'church','cigar','circle','citizen','city','civil','claim','clap','clarify','claw',
  'clay','clean','clerk','clever','click','client','cliff','climb','clinic','clip',
  'clock','close','cloth','cloud','clown','club','clump','cluster','clutch','coach',
  'coast','coconut','code','coffee','coil','coin','collect','color','column','combine',
];

function generateSecretKey(): string {
  const words: string[] = [];
  for (let i = 0; i < 12; i++) {
    const idx = crypto.randomInt(0, WORDLIST.length);
    words.push(WORDLIST[idx]);
  }
  return words.join(' ');
}

// Generate a 6-character alphanumeric referral code
function generateReferralCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No I, O, 0, 1 to avoid confusion
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[crypto.randomInt(0, chars.length)];
  }
  return code;
}

// Simple encryption for storing secret key (AES-256-GCM)
const ENCRYPTION_KEY = crypto.scryptSync(
  env.JWT_SECRET || 'clb-default-secret-key-change-me',
  'salt-clb-secret-key',
  32
);

function encryptSecretKey(plaintext: string): { encrypted: string; iv: string } {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  return { encrypted: `${authTag}:${encrypted}`, iv: iv.toString('hex') };
}

function decryptSecretKey(encrypted: string, ivHex: string): string {
  const [authTagHex, ciphertext] = encrypted.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
  let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

// Swagger schemas
const schemas = {
  getNonce: {
    tags: ['Auth'],
    summary: 'Get nonce for wallet signature',
    description: 'Returns a unique nonce for the given wallet address to sign for authentication',
    params: {
      type: 'object',
      properties: {
        walletAddress: { type: 'string', description: 'Ethereum/BSC wallet address' },
      },
      required: ['walletAddress'],
    },
    response: {
      200: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          nonce: { type: 'string' },
        },
      },
    },
  },
  verifyWallet: {
    tags: ['Auth'],
    summary: 'Verify wallet signature and get JWT',
    description: 'Verifies the signed nonce message and returns a JWT token',
    body: {
      type: 'object',
      properties: {
        walletAddress: { type: 'string' },
        signature: { type: 'string' },
      },
      required: ['walletAddress', 'signature'],
    },
    response: {
      200: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          token: { type: 'string' },
          user: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              walletAddress: { type: 'string' },
              username: { type: 'string', nullable: true },
              role: { type: 'string' },
            },
          },
        },
      },
    },
  },
  getProfile: {
    tags: ['Auth'],
    summary: 'Get current user profile',
    description: 'Returns the authenticated user profile (requires JWT)',
    headers: {
      type: 'object',
      properties: {
        authorization: { type: 'string', description: 'Bearer <JWT token>' },
      },
    },
    response: {
      200: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          user: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              walletAddress: { type: 'string' },
              username: { type: 'string', nullable: true },
              email: { type: 'string', nullable: true },
              role: { type: 'string' },
              isActive: { type: 'boolean' },
              createdAt: { type: 'string' },
            },
          },
        },
      },
    },
  },
  updateProfile: {
    tags: ['Auth'],
    summary: 'Update user profile',
    description: 'Update username and/or email for the authenticated user',
    body: {
      type: 'object',
      properties: {
        username: { type: 'string' },
        email: { type: 'string', format: 'email' },
      },
    },
    response: {
      200: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          user: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              walletAddress: { type: 'string' },
              username: { type: 'string', nullable: true },
              email: { type: 'string', nullable: true },
            },
          },
        },
      },
    },
  },
};

export default async function authRoutes(fastify: FastifyInstance) {
  // GET /auth/nonce/:walletAddress — get nonce for signing
  fastify.get<{ Params: { walletAddress: string } }>(
    '/nonce/:walletAddress',
    { schema: schemas.getNonce },
    async (request, reply) => {
      const { walletAddress } = request.params;
      const normalized = walletAddress.toLowerCase();

      // Find or create user
      let user = await prisma.user.findUnique({
        where: { walletAddress: normalized },
      });

      if (!user) {
        const secretKey = generateSecretKey();
        const { encrypted, iv } = encryptSecretKey(secretKey);
        const referralCode = generateReferralCode();
        user = await prisma.user.create({
          data: { walletAddress: normalized, secretKey: encrypted, secretKeyIv: iv, referralCode },
        });
      }

      return { success: true, nonce: user.nonce };
    }
  );

  // POST /auth/verify — verify wallet signature, return JWT
  fastify.post<{ Body: { walletAddress: string; signature: string } }>(
    '/verify',
    { schema: schemas.verifyWallet },
    async (request, reply) => {
      const { walletAddress, signature } = request.body;
      const normalized = walletAddress.toLowerCase();

      const user = await prisma.user.findUnique({
        where: { walletAddress: normalized },
      });

      if (!user) {
        return reply.status(404).send({ success: false, error: 'User not found. Get nonce first.' });
      }

      // Verify signature
      // Dev mode: accept demo signatures (prefix 'demo-sig') to allow mobile app testing
      const isDemoSig = signature.startsWith('demo-sig') && env.NODE_ENV === 'development';

      if (!isDemoSig) {
        const message = `Sign this message to authenticate.\nNonce: ${user.nonce}`;
        try {
          const recoveredAddress = ethers.verifyMessage(message, signature);
          if (recoveredAddress.toLowerCase() !== normalized) {
            return reply.status(401).send({ success: false, error: 'Signature verification failed' });
          }
        } catch {
          return reply.status(401).send({ success: false, error: 'Invalid signature' });
        }
      } else {
        fastify.log.warn(`⚠️  DEV MODE: Skipping signature verification for ${normalized}`);
      }

      // Rotate nonce + increment tokenVersion (invalidates old tokens on other devices)
      const updatedUser = await prisma.user.update({
        where: { id: user.id },
        data: { nonce: crypto.randomUUID(), tokenVersion: { increment: 1 } },
      });

      // Generate JWT (include tokenVersion for single-device enforcement)
      const token = fastify.jwt.sign(
        { id: user.id, walletAddress: normalized, role: user.role, tokenVersion: updatedUser.tokenVersion },
        { expiresIn: '7d' }
      );

      return {
        success: true,
        token,
        user: {
          id: updatedUser.id,
          walletAddress: updatedUser.walletAddress,
          username: updatedUser.username,
          role: updatedUser.role,
          pinSetup: !!user.pinHash,
          biometricEnabled: user.biometricEnabled ?? false,
          createdAt: user.createdAt,
        },
      };
    }
  );

  // GET /auth/wallet-available/:walletAddress — read-only: can this address register as a new user?
  fastify.get<{ Params: { walletAddress: string } }>(
    '/wallet-available/:walletAddress',
    {
      schema: {
        tags: ['Auth'],
        summary: 'Check if wallet address is available for registration',
        description:
          'Returns whether no user row exists for this BEP-20 address (case-insensitive). No DB writes.',
        params: {
          type: 'object',
          properties: { walletAddress: { type: 'string' } },
          required: ['walletAddress'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              available: { type: 'boolean' },
              walletAddress: { type: 'string' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const raw = request.params.walletAddress?.trim() ?? '';
      const normalized = raw.toLowerCase();
      if (!normalized.startsWith('0x') || normalized.length !== 42 || !/^0x[0-9a-f]{40}$/.test(normalized)) {
        return reply.status(400).send({ success: false, error: 'Invalid BEP-20 address' });
      }
      const existing = await prisma.user.findFirst({
        where: { walletAddress: { equals: normalized, mode: 'insensitive' } },
      });
      return {
        success: true,
        available: !existing,
        walletAddress: normalized,
      };
    }
  );

  // POST /auth/dev-login — development login without signature (for mobile app testing)
  fastify.post<{ Body: { walletAddress: string; email?: string; recoveryPhrase?: string; accountPassword?: string } }>(
    '/dev-login',
    {
      schema: {
        tags: ['Auth'],
        summary: 'Dev login (no signature required)',
        description:
          'Creates a new user only. If the wallet address is already registered, returns 403 — use POST /import with recovery phrase + PIN. Optional BIP39 recoveryPhrase must derive the same address. Optional accountPassword (8+ chars) is stored as passwordHash for account recovery flows.',
        body: {
          type: 'object',
          properties: {
            walletAddress: { type: 'string' },
            email: { type: 'string', format: 'email' },
            recoveryPhrase: { type: 'string', description: '12+ word BIP39 phrase; must match walletAddress for new accounts' },
            accountPassword: { type: 'string', minLength: 8, maxLength: 128, description: 'Optional app account password from registration step 1' },
          },
          required: ['walletAddress'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              token: { type: 'string' },
              user: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  walletAddress: { type: 'string' },
                  username: { type: 'string', nullable: true },
                  role: { type: 'string' },
                  referralCode: { type: 'string', nullable: true },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { walletAddress, email, recoveryPhrase, accountPassword } = request.body;
      const normalized = walletAddress.toLowerCase();
      const emailNorm = email?.trim().toLowerCase() || undefined;
      let passwordHash: string | undefined;
      if (accountPassword != null && String(accountPassword).length > 0) {
        const pw = String(accountPassword);
        if (pw.length < 8) {
          return reply.status(400).send({ success: false, error: 'Account password must be at least 8 characters' });
        }
        passwordHash = await bcrypt.hash(pw, 10);
      }

      let phraseNorm: string | undefined;
      if (recoveryPhrase?.trim()) {
        phraseNorm = recoveryPhrase.trim().replace(/\s+/g, ' ').toLowerCase();
        const wc = phraseNorm.split(' ').filter(Boolean).length;
        if (wc < 12) {
          return reply.status(400).send({ success: false, error: 'Recovery phrase must have at least 12 words' });
        }
        try {
          const derived = ethers.HDNodeWallet.fromPhrase(phraseNorm);
          if (derived.address.toLowerCase() !== normalized) {
            return reply
              .status(400)
              .send({ success: false, error: 'Wallet address does not match this recovery phrase' });
          }
        } catch {
          return reply.status(400).send({ success: false, error: 'Invalid BIP39 recovery phrase' });
        }
      }

      // Case-insensitive: same BEP-20 address must not register twice (Postgres text is case-sensitive).
      const existing = await prisma.user.findFirst({
        where: { walletAddress: { equals: normalized, mode: 'insensitive' } },
      });
      if (existing) {
        return reply.status(403).send({
          success: false,
          code: 'WALLET_ALREADY_REGISTERED',
          error:
            'This wallet is already registered. Tap “I already have a wallet”, enter your 12-word recovery phrase and the PIN you created during registration.',
        });
      }

      const secretPlain = phraseNorm ?? generateSecretKey();
      const { encrypted, iv } = encryptSecretKey(secretPlain);
      const referralCode = generateReferralCode();
      let user;
      try {
        user = await prisma.user.create({
          data: {
            walletAddress: normalized,
            secretKey: encrypted,
            secretKeyIv: iv,
            referralCode,
            ...(emailNorm ? { email: emailNorm } : {}),
            ...(passwordHash ? { passwordHash } : {}),
          },
        });
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
          const targets = (e.meta as { target?: string[] })?.target ?? [];
          if (targets.includes('walletAddress')) {
            return reply.status(403).send({
              success: false,
              code: 'WALLET_ALREADY_REGISTERED',
              error:
                'This wallet is already registered. Use “I already have a wallet” with your recovery phrase and PIN.',
            });
          }
          return reply
            .status(409)
            .send({ success: false, error: 'Email is already used by another account' });
        }
        throw e;
      }
      fastify.log.info(`🆕 New user created via dev-login: ${normalized} (referral: ${referralCode})`);

      // Increment tokenVersion (invalidates old tokens on other devices)
      const updatedUser = await prisma.user.update({
        where: { id: user.id },
        data: { tokenVersion: { increment: 1 } },
      });

      // Generate JWT (include tokenVersion for single-device enforcement)
      const token = fastify.jwt.sign(
        { id: user.id, walletAddress: normalized, role: user.role, tokenVersion: updatedUser.tokenVersion },
        { expiresIn: '7d' }
      );

      const fresh = await prisma.user.findUnique({
        where: { id: user.id },
        select: {
          id: true,
          walletAddress: true,
          username: true,
          email: true,
          role: true,
          referralCode: true,
          pinHash: true,
          biometricEnabled: true,
          createdAt: true,
        },
      });

      return {
        success: true,
        token,
        user: {
          id: fresh!.id,
          walletAddress: fresh!.walletAddress,
          username: fresh!.username,
          email: fresh!.email,
          role: fresh!.role,
          referralCode: fresh!.referralCode,
          pinSetup: !!fresh!.pinHash,
          biometricEnabled: fresh!.biometricEnabled ?? false,
          createdAt: fresh!.createdAt,
        },
      };
    }
  );

  // POST /auth/create-wallet — generate a new wallet (Trust Wallet style)
  fastify.post(
    '/create-wallet',
    {
      schema: {
        tags: ['Auth'],
        summary: 'Create a new wallet',
        description: 'Generates a new wallet with a 12-word recovery phrase, wallet address, and JWT. The recovery phrase is shown once — user must back it up.',
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      // Generate wallet using ethers.js (creates real BEP-20/ETH address + mnemonic)
      const wallet = ethers.Wallet.createRandom();
      const walletAddress = wallet.address.toLowerCase();
      const mnemonic = wallet.mnemonic?.phrase;

      if (!mnemonic) {
        return reply.status(500).send({ success: false, error: 'Failed to generate wallet' });
      }

      // Encrypt and store the recovery phrase
      const { encrypted, iv } = encryptSecretKey(mnemonic);
      const referralCode = generateReferralCode();

      const user = await prisma.user.create({
        data: {
          walletAddress,
          secretKey: encrypted,
          secretKeyIv: iv,
          referralCode,
        },
      });

      // Generate JWT
      const token = fastify.jwt.sign(
        { id: user.id, walletAddress, role: user.role, tokenVersion: user.tokenVersion },
        { expiresIn: '7d' }
      );

      fastify.log.info(`🆕 New wallet created: ${walletAddress}`);

      return {
        success: true,
        token,
        walletAddress,
        seedPhrase: mnemonic,
        user: {
          id: user.id,
          walletAddress: user.walletAddress,
          username: user.username,
          role: user.role,
          referralCode: user.referralCode,
          pinSetup: false,
          biometricEnabled: false,
          createdAt: user.createdAt,
        },
      };
    }
  );

  // POST /auth/setup-pin — set up PIN for mobile app security (protected)
  fastify.post<{ Body: { pin: string; enableBiometric?: boolean } }>(
    '/setup-pin',
    { preHandler: [authMiddleware] },
    async (request: FastifyRequest<{ Body: { pin: string; enableBiometric?: boolean } }>, reply: FastifyReply) => {
      const userId = request.userId!;
      const { pin, enableBiometric = false } = request.body;

      if (!pin || pin.length !== 6 || !/^\d+$/.test(pin)) {
        return reply.status(400).send({ success: false, error: 'PIN must be 6 digits' });
      }

      const salt = crypto.randomBytes(16).toString('hex');
      const pinHash = crypto.createHash('sha256').update(pin + salt).digest('hex');

      await prisma.user.update({
        where: { id: userId },
        data: { pinHash, pinSalt: salt, biometricEnabled: enableBiometric },
      });

      return { success: true };
    }
  );

  // POST /auth/verify-pin — verify PIN on app open (protected)
  fastify.post<{ Body: { pin: string } }>(
    '/verify-pin',
    { preHandler: [authMiddleware] },
    async (request: FastifyRequest<{ Body: { pin: string } }>, reply: FastifyReply) => {
      const userId = request.userId!;
      const { pin } = request.body;

      const user = await prisma.user.findUnique({ where: { id: userId } });

      if (!user?.pinHash || !user?.pinSalt) {
        return reply.status(400).send({ success: false, error: 'PIN not set up' });
      }

      const pinHash = crypto.createHash('sha256').update(pin + user.pinSalt).digest('hex');

      if (pinHash !== user.pinHash) {
        return reply.status(401).send({ success: false, error: 'Invalid PIN' });
      }

      return { success: true, biometricEnabled: user.biometricEnabled };
    }
  );

  // POST /auth/enable-biometric — enable/disable biometric unlock (protected)
  fastify.post<{ Body: { enabled: boolean } }>(
    '/biometric',
    { preHandler: [authMiddleware] },
    async (request: FastifyRequest<{ Body: { enabled: boolean } }>) => {
      const userId = request.userId!;

      await prisma.user.update({
        where: { id: userId },
        data: { biometricEnabled: request.body.enabled },
      });

      return { success: true };
    }
  );

  // GET /auth/profile — get user profile (protected)
  fastify.get(
    '/profile',
    { schema: schemas.getProfile, preHandler: [authMiddleware] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = await prisma.user.findUnique({
        where: { id: request.userId },
        select: {
          id: true,
          walletAddress: true,
          username: true,
          email: true,
          avatar: true,
          referralCode: true,
          role: true,
          isActive: true,
          createdAt: true,
          pinHash: true,
          pinSalt: true,
          biometricEnabled: true,
        },
      });

      if (!user) {
        return reply.status(404).send({ success: false, error: 'User not found' });
      }

      return {
        success: true,
        user,
      };
    }
  );

  // POST /auth/admin-login — admin email/password login
  fastify.post<{ Body: { email: string; password: string } }>(
    '/admin-login',
    {
      schema: {
        tags: ['Auth'],
        summary: 'Admin login with email and password',
        body: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: { type: 'string', format: 'email' },
            password: { type: 'string', minLength: 6 },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              token: { type: 'string' },
              user: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  walletAddress: { type: 'string' },
                  username: { type: 'string', nullable: true },
                  role: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Body: { email: string; password: string } }>, reply: FastifyReply) => {
      const { email, password } = request.body;

      const user = await prisma.user.findFirst({
        where: { email: email.toLowerCase(), role: 'ADMIN' },
      });

      if (!user || !user.passwordHash) {
        return reply.status(401).send({ success: false, error: 'Invalid email or password' });
      }

      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) {
        return reply.status(401).send({ success: false, error: 'Invalid email or password' });
      }

      // Increment tokenVersion (invalidates old admin tokens on other devices)
      const updatedUser = await prisma.user.update({
        where: { id: user.id },
        data: { tokenVersion: { increment: 1 } },
      });

      const token = fastify.jwt.sign(
        { id: user.id, walletAddress: user.walletAddress, role: user.role, tokenVersion: updatedUser.tokenVersion },
        { expiresIn: '7d' }
      );

      return {
        success: true,
        token,
        user: {
          id: user.id,
          walletAddress: user.walletAddress,
          username: user.username,
          role: user.role,
        },
      };
    }
  );

  // PUT /auth/profile — update profile (protected)
  fastify.put<{ Body: { username?: string; email?: string; avatar?: string } }>(
    '/profile',
    { preHandler: [authMiddleware] },
    async (request: FastifyRequest<{ Body: { username?: string; email?: string; avatar?: string } }>, reply: FastifyReply) => {
      const { username, email, avatar } = request.body;

      const user = await prisma.user.update({
        where: { id: request.userId },
        data: {
          ...(username !== undefined && { username }),
          ...(email !== undefined && { email }),
          ...(avatar !== undefined && { avatar }),
        },
        select: {
          id: true,
          walletAddress: true,
          username: true,
          email: true,
          avatar: true,
        },
      });

      return { success: true, user };
    }
  );

  // ─── Secret Key Endpoints ──────────────────────────────────────

  // GET /auth/secret-key — view your secret key (requires PIN verification)
  fastify.post<{ Body: { pin: string } }>(
    '/secret-key',
    {
      preHandler: [authMiddleware],
      schema: {
        tags: ['Auth'],
        summary: 'View your recovery secret key',
        description: 'Returns the decrypted 12-word recovery phrase. Requires PIN verification.',
        body: {
          type: 'object',
          required: ['pin'],
          properties: { pin: { type: 'string', minLength: 6, maxLength: 6 } },
        },
      },
    },
    async (request: FastifyRequest<{ Body: { pin: string } }>, reply: FastifyReply) => {
      const userId = request.userId!;
      const { pin } = request.body;

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { pinHash: true, pinSalt: true, secretKey: true, secretKeyIv: true, walletAddress: true },
      });

      if (!user) {
        return reply.status(404).send({ success: false, error: 'User not found' });
      }

      // Verify PIN first
      if (!user.pinHash || !user.pinSalt) {
        return reply.status(400).send({ success: false, error: 'PIN not set up. Set up PIN first.' });
      }

      const pinHash = crypto.createHash('sha256').update(pin + user.pinSalt).digest('hex');
      if (pinHash !== user.pinHash) {
        return reply.status(401).send({ success: false, error: 'Invalid PIN' });
      }

      if (!user.secretKey || !user.secretKeyIv) {
        return reply.status(404).send({ success: false, error: 'No secret key found. Generate one first.' });
      }

      const secretKey = decryptSecretKey(user.secretKey, user.secretKeyIv);

      return {
        success: true,
        secretKey,
        walletAddress: user.walletAddress,
        warning: 'Store this key safely. Never share it with anyone. It can restore your account on any device.',
      };
    }
  );

  // POST /auth/secret-key/generate — generate secret key for existing users who don't have one
  fastify.post(
    '/secret-key/generate',
    { preHandler: [authMiddleware] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = request.userId!;

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { secretKey: true, walletAddress: true },
      });

      if (!user) {
        return reply.status(404).send({ success: false, error: 'User not found' });
      }

      if (user.secretKey) {
        return reply.status(400).send({ success: false, error: 'Secret key already exists. Use /secret-key to view it.' });
      }

      const secretKey = generateSecretKey();
      const { encrypted, iv } = encryptSecretKey(secretKey);

      await prisma.user.update({
        where: { id: userId },
        data: { secretKey: encrypted, secretKeyIv: iv },
      });

      return {
        success: true,
        secretKey,
        walletAddress: user.walletAddress,
        warning: 'SAVE THIS KEY NOW! You will need it to recover your account. It will NOT be shown again.',
      };
    }
  );

  const normRecoveryPhrase = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');

  // POST /auth/import — restore account from secret key (+ PIN when account has PIN set)
  fastify.post<{ Body: { secretKey: string; pin?: string } }>(
    '/import',
    {
      schema: {
        tags: ['Auth'],
        summary: 'Import/restore account from secret key',
        description:
          '12-word recovery phrase. If the account has a PIN, send the same 6-digit PIN from registration.',
        body: {
          type: 'object',
          required: ['secretKey'],
          properties: {
            secretKey: { type: 'string', description: '12-word recovery phrase' },
            pin: { type: 'string', description: '6-digit PIN when account has PIN set' },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Body: { secretKey: string; pin?: string } }>, reply: FastifyReply) => {
      const { secretKey, pin } = request.body;
      const normalizedKey = normRecoveryPhrase(secretKey);
      const wordCount = normalizedKey.split(' ').filter(Boolean).length;

      if (!normalizedKey || wordCount < 12) {
        return reply.status(400).send({ success: false, error: 'Enter all 12 words of your recovery phrase.' });
      }

      const users = await prisma.user.findMany({
        where: { secretKey: { not: null } },
        select: {
          id: true,
          walletAddress: true,
          secretKey: true,
          secretKeyIv: true,
          role: true,
          nonce: true,
          createdAt: true,
          pinHash: true,
          pinSalt: true,
          biometricEnabled: true,
        },
      });

      let matchedUser: (typeof users)[0] | null = null;
      for (const u of users) {
        try {
          const decrypted = decryptSecretKey(u.secretKey!, u.secretKeyIv!);
          if (normRecoveryPhrase(decrypted) === normalizedKey) {
            matchedUser = u;
            break;
          }
        } catch {
          continue;
        }
      }

      if (!matchedUser) {
        return reply.status(404).send({ success: false, error: 'No account found with this recovery phrase' });
      }

      if (matchedUser.pinHash && matchedUser.pinSalt) {
        if (!pin || pin.length !== 6 || !/^\d+$/.test(pin)) {
          return reply.status(400).send({
            success: false,
            code: 'PIN_REQUIRED',
            error: 'This account has a PIN. Enter your 6-digit PIN from registration.',
          });
        }
        const pinHash = crypto.createHash('sha256').update(pin + matchedUser.pinSalt).digest('hex');
        if (pinHash !== matchedUser.pinHash) {
          return reply.status(401).send({ success: false, error: 'Wrong PIN' });
        }
      }

      // Increment tokenVersion (invalidates old tokens)
      const updatedUser = await prisma.user.update({
        where: { id: matchedUser.id },
        data: { tokenVersion: { increment: 1 }, nonce: crypto.randomUUID() },
      });

      const token = fastify.jwt.sign(
        {
          id: matchedUser.id,
          walletAddress: matchedUser.walletAddress,
          role: matchedUser.role,
          tokenVersion: updatedUser.tokenVersion,
        },
        { expiresIn: '7d' }
      );

      const hasPin = !!matchedUser.pinHash;

      return {
        success: true,
        token,
        user: {
          id: matchedUser.id,
          walletAddress: matchedUser.walletAddress,
          role: matchedUser.role,
          pinSetup: hasPin,
          biometricEnabled: matchedUser.biometricEnabled ?? false,
          createdAt: matchedUser.createdAt,
        },
        message: hasPin
          ? 'Account restored. Unlock with your PIN on the next screen if prompted.'
          : 'Account restored. Set up a PIN for this device.',
      };
    }
  );

  // POST /auth/recover — restore by BEP-20 + (12-word phrase XOR account password) + PIN when set
  fastify.post<{
    Body: {
      walletAddress: string;
      method: 'phrase' | 'password';
      phrase?: string;
      accountPassword?: string;
      pin?: string;
    };
  }>(
    '/recover',
    {
      schema: {
        tags: ['Auth'],
        summary: 'Recover CLB account by address + phrase or account password',
        description:
          'Requires the wallet BEP-20 used at registration. Use method=phrase with 12+ words, or method=password with the account password set during email signup. PIN required when the account has PIN set.',
        body: {
          type: 'object',
          required: ['walletAddress', 'method'],
          properties: {
            walletAddress: { type: 'string' },
            method: { type: 'string', enum: ['phrase', 'password'] },
            phrase: { type: 'string' },
            accountPassword: { type: 'string' },
            pin: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const { walletAddress, method, phrase, accountPassword, pin } = request.body;
      const normalized = walletAddress.trim().toLowerCase();
      if (!normalized.startsWith('0x') || normalized.length !== 42 || !/^0x[0-9a-f]{40}$/.test(normalized)) {
        return reply.status(400).send({ success: false, error: 'Enter a valid BEP-20 address' });
      }

      const user = await prisma.user.findFirst({
        where: { walletAddress: { equals: normalized, mode: 'insensitive' } },
        select: {
          id: true,
          walletAddress: true,
          secretKey: true,
          secretKeyIv: true,
          passwordHash: true,
          pinHash: true,
          pinSalt: true,
          role: true,
          biometricEnabled: true,
          createdAt: true,
        },
      });

      if (!user) {
        return reply.status(404).send({ success: false, error: 'No CLB account found for this address' });
      }

      if (method === 'phrase') {
        const normalizedPhrase = normRecoveryPhrase(phrase ?? '');
        const wc = normalizedPhrase.split(' ').filter(Boolean).length;
        if (wc < 12) {
          return reply.status(400).send({ success: false, error: 'Enter all 12 words of your recovery phrase.' });
        }
        if (!user.secretKey || !user.secretKeyIv) {
          return reply.status(400).send({ success: false, error: 'This account has no recovery phrase on file.' });
        }
        let decrypted: string;
        try {
          decrypted = decryptSecretKey(user.secretKey, user.secretKeyIv);
        } catch {
          return reply.status(500).send({ success: false, error: 'Could not verify recovery data' });
        }
        if (normRecoveryPhrase(decrypted) !== normalizedPhrase) {
          return reply.status(401).send({ success: false, error: 'Recovery phrase does not match this wallet address' });
        }
        try {
          const derived = ethers.HDNodeWallet.fromPhrase(normalizedPhrase).address.toLowerCase();
          if (derived !== user.walletAddress.toLowerCase()) {
            return reply.status(400).send({ success: false, error: 'Phrase does not match this address' });
          }
        } catch {
          return reply.status(400).send({ success: false, error: 'Invalid recovery phrase' });
        }
      } else if (method === 'password') {
        const pw = accountPassword?.trim() ?? '';
        if (pw.length < 8) {
          return reply.status(400).send({ success: false, error: 'Enter your account password (8+ characters)' });
        }
        if (!user.passwordHash) {
          return reply.status(400).send({
            success: false,
            code: 'NO_ACCOUNT_PASSWORD',
            error:
              'No account password is stored for this wallet. Use recovery phrase instead, or register again with email + password.',
          });
        }
        const match = await bcrypt.compare(pw, user.passwordHash);
        if (!match) {
          return reply.status(401).send({ success: false, error: 'Wrong account password for this address' });
        }
      } else {
        return reply.status(400).send({ success: false, error: 'method must be phrase or password' });
      }

      if (user.pinHash && user.pinSalt) {
        if (!pin || pin.length !== 6 || !/^\d+$/.test(pin)) {
          return reply.status(400).send({
            success: false,
            code: 'PIN_REQUIRED',
            error: 'This account has a PIN. Enter your 6-digit PIN from registration.',
          });
        }
        const pinHash = crypto.createHash('sha256').update(pin + user.pinSalt).digest('hex');
        if (pinHash !== user.pinHash) {
          return reply.status(401).send({ success: false, error: 'Wrong PIN' });
        }
      }

      const updatedUser = await prisma.user.update({
        where: { id: user.id },
        data: { tokenVersion: { increment: 1 }, nonce: crypto.randomUUID() },
      });

      const token = fastify.jwt.sign(
        {
          id: user.id,
          walletAddress: user.walletAddress,
          role: user.role,
          tokenVersion: updatedUser.tokenVersion,
        },
        { expiresIn: '7d' }
      );

      const hasPin = !!user.pinHash;

      return {
        success: true,
        token,
        user: {
          id: user.id,
          walletAddress: user.walletAddress,
          role: user.role,
          pinSetup: hasPin,
          biometricEnabled: user.biometricEnabled ?? false,
          createdAt: user.createdAt,
        },
        message: hasPin
          ? 'Account restored. Unlock with your PIN on the next screen if prompted.'
          : 'Account restored. Set up a PIN for this device.',
      };
    }
  );
}
