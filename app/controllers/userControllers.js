import { validationResult } from 'express-validator';
import { User } from "../services/userServices.js";
import { localKey } from '../config/paseto.js';
import { encrypt } from 'paseto-ts/v4';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
import { Attendance } from '../services/attendanceService.js';
dotenv.config();

export function userResponse(user) {
    return {
        id: user.id,
        first_name: user.first_name,
        last_name: user.last_name,
        username: user.username,
        email: user.email,
        position: user.position,
        created_at: user.created_at,
        updated_at: user.updated_at,
    }
}

export const CreateUserController = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(422).json({ errors: errors.array() });
    }

    const { first_name, last_name, username, email, position, password } = req.body

    const saltRounds = parseInt(process.env.SALT_ROUNDS, 10);
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    try {
        const createdUser = await User.createUser(first_name, last_name, username, email, position, hashedPassword);
        return res.status(201).json({ message: 'User created successfully', data: userResponse(createdUser) });
    } catch (error) {
        console.error('Create user error:', error.message);
        return res.status(400).json({ error: error.message, data: null });
    }
}

export const LoginUserController = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(422).json({ errors: errors.array() });
    }

    const { username, password } = req.body;

    try {
        const getUser = await User.getUserForLogin(username);
        if (!getUser) {
            return res.status(401).json({ message: 'Invalid username' });
        }

        const isMatch = await bcrypt.compare(password, getUser.password);

        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid password' });
        }

        const token = await encrypt(
            localKey,
            { sub: getUser.username, user_id: getUser.id, role: 'user', iat: new Date().toISOString()},
        )

        res.cookie('token', token, {
            httpOnly: true,
            secure: true,
            sameSite: 'None',
            maxAge: 60 * 60 * 1000
        })

        return res.status(200).json({ message: 'Login successful', data: userResponse(getUser) });
    } catch (error) {
        console.error('Login error: ', error.message);
        return res.status(400).json({ message: error.message });
  }
}

export const UpdateUserForUserController = async (req, res) => {
    const { role, user_id } = req.user
    if (role !== 'user') {
        return res.status(403).json({ errors: 'Unauthorized user'})
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(422).json({ errors: errors.array() });
    }

    try {
        const getUser = await User.getUserById(user_id);
        if (!getUser) {
            return res.status(401).json({ message: "User doesn't exist" });
        }

        const updatedUser = await User.updateUser(getUser.id, req.body)
        return res.status(200).json({ message: 'User update successfully', data: userResponse(updatedUser) });
    } catch(error) {
        console.error('Update user error:', error.message);
        return res.status(400).json({ error: error.message, data: null });
    }
}

export const GetUserPofileController = async (req, res) => {
    const { role, user_id } = req.user
    if (role !== 'user') {
        return res.status(403).json({ errors: 'Unauthorized user'})
    }

    try {
        const getUser = await User.getUserById(user_id)
        return res.status(200).json({ message: 'Get user successfully', data: userResponse(getUser) });
    } catch (error) {
        console.error('Get user error:', error.message);
        return res.status(400).json({ error: error.message, data: null });
    }
}

export const GetAllUser = async (req, res) => {
    const { role } = req.user
    if (role !== 'admin') {
        return res.status(403).json({ errors: 'Unauthorized user'})
    }

    const { limit, page } = req.query;

    const pageNumber = parseInt(page) || 1;
    const limitNumber = parseInt(limit) || 10;

    const offset = (pageNumber - 1) * limitNumber;

    try {
        const getUsers = await User.getAllUser(limitNumber, offset)
        return res.status(200).json({ message: 'Get users successfully', data: getUsers });
    } catch (error) {
        console.error('Get users error:', error.message);
        return res.status(400).json({ error: error.message, data: null });
    }
}

export const GetMeController = async (req, res) => {
    const { role, user_id } = req.user
    if (role !== 'user' && role !== 'admin') {
        return res.status(403).json({ errors: 'Unauthorized user'})
    }

    try {
        const getUser = await User.me(user_id, role)
        return res.status(200).json({ message: 'Get me successfully', data: userResponse(getUser) });
    } catch (error) {
        console.error('Get me error:', error.message);
        return res.status(400).json({ error: error.message, data: null });
    }
}

export const LogoutController = async (req, res) => {
    const { role } = req.user
    if (role !== 'user' && role !== 'admin') {
        return res.status(403).json({ errors: 'Unauthorized user'})
    }

    res.clearCookie('token');
    res.json({ message: 'Logged out' });
}