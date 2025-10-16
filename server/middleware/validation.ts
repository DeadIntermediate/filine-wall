import { Request, Response, NextFunction } from "express";
import { z, ZodSchema } from "zod";

export interface ValidationSchemas {
  body?: ZodSchema;
  params?: ZodSchema;
  query?: ZodSchema;
}

export const validate = (schemas: ValidationSchemas) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      // Validate request body
      if (schemas.body) {
        req.body = schemas.body.parse(req.body);
      }

      // Validate request parameters
      if (schemas.params) {
        req.params = schemas.params.parse(req.params);
      }

      // Validate query parameters
      if (schemas.query) {
        req.query = schemas.query.parse(req.query);
      }

      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          message: "Validation error",
          errors: error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message,
            code: err.code
          }))
        });
      }
      
      return res.status(400).json({
        message: "Invalid request data"
      });
    }
  };
};

// Common validation schemas
export const phoneNumberSchema = z.string()
  .regex(/^\+?[1-9]\d{1,14}$/, "Invalid phone number format")
  .min(10, "Phone number too short")
  .max(15, "Phone number too long");

export const deviceIdSchema = z.string()
  .regex(/^device_[a-f0-9]{16}$/, "Invalid device ID format");

export const authSchemas = {
  login: {
    body: z.object({
      username: z.string().min(3).max(50),
      password: z.string().min(6).max(100)
    })
  },
  register: {
    body: z.object({
      username: z.string().min(3).max(50),
      password: z.string().min(6).max(100),
      role: z.enum(['admin', 'user']).optional()
    })
  }
};

export const callSchemas = {
  screenCall: {
    params: z.object({
      deviceId: deviceIdSchema
    }),
    body: z.object({
      data: z.string() // encrypted data
    })
  },
  reportSpam: {
    body: z.object({
      phoneNumber: phoneNumberSchema,
      category: z.enum(['telemarketing', 'scam', 'robocall', 'spam', 'user_reported']),
      description: z.string().max(500).optional()
    })
  }
};

export const deviceSchemas = {
  register: {
    body: z.object({
      deviceName: z.string().min(1).max(100),
      deviceType: z.enum(['raspberry_pi', 'android', 'custom']),
      publicKey: z.string().min(1)
    })
  },
  heartbeat: {
    params: z.object({
      deviceId: deviceIdSchema
    }),
    body: z.object({
      data: z.string() // encrypted data
    })
  }
};

export const adminSchemas = {
  addNumber: {
    body: z.object({
      number: phoneNumberSchema,
      type: z.enum(['blacklist', 'whitelist']),
      description: z.string().max(200).optional()
    })
  },
  deleteNumber: {
    params: z.object({
      id: z.string().regex(/^\d+$/, "Invalid ID").transform(Number)
    })
  }
};