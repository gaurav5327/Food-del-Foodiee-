import e from "express";
import orderModel from "../models/orderModel.js";
import userModel from "../models/userModel.js"
import Stripe from "stripe"

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

// placing user order from frontend
const placeOrder = async (req, res) => {
    const frontend_url = "http://localhost:5174"

    try {
        // Get userId from the token

        const newOrder = new orderModel({
            userId: req.body.userId,
            items: req.body.items,
            amount: req.body.amount,
            address: req.body.address
        })
        await newOrder.save();
        await userModel.findByIdAndUpdate(req.body.userId, { cartData: {} });

        const line_items = req.body.items.map((item) => ({
            price_data: {
                currency: "inr",
                product_data: {
                    name: item.name
                },
                unit_amount: item.price * 100 * 80
            },
            quantity: item.quantity
        }))

        // Add delivery charges
        line_items.push({
            price_data: {
                currency: "inr",
                product_data: {
                    name: "Delievery Charges"
                },
                unit_amount: 2 * 100 * 80
            },
            quantity: 1
        })

        const session = await stripe.checkout.sessions.create({
            line_items: line_items,
            mode: "payment",
            success_url: `${frontend_url}/verify?success=true&orderId=${newOrder._id}`,
            cancel_url: `${frontend_url}/verify?success=false&orderId=${newOrder._id}`,
        })

        res.json({ success: true, session_url: session.url })
    } catch (error) {
        console.log(error);
        res.json({ success: false, message: "Error" })
    }
}

const verifyOrder = async (req, res) => {
    const { orderId, success } = req.body;

    if (!orderId) {
        return res.status(400).json({
            success: false,
            message: "Order ID is required"
        });
    }

    if (success === undefined || success === null) {
        return res.status(400).json({
            success: false,
            message: "Payment status is required"
        });
    }

    try {
        const order = await orderModel.findById(orderId);

        if (!order) {
            return res.status(404).json({
                success: false,
                message: "Order not found"
            });
        }

        // Check if order is already verified
        if (order.payment) {
            return res.status(400).json({
                success: false,
                message: "Order is already verified"
            });
        }

        const isSuccess = String(success).toLowerCase() === "true";

        if (isSuccess) {
            await orderModel.findByIdAndUpdate(orderId, {
                payment: true,
                status: "Paid",
                verifiedAt: new Date()
            });
            res.json({
                success: true,
                message: "Payment verified successfully"
            });
        } else {
            await orderModel.findByIdAndUpdate(orderId, {
                status: "Payment Failed",
                payment: false
            });
            res.json({
                success: false,
                message: "Payment failed"
            });
        }
    } catch (error) {
        console.error("Verify order error:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error while verifying payment",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
}



const getUserOrders = async (req, res) => {
    try {
        // Get userId from the token (set by auth middleware)
        const userId = req.body.userId;

        if (!userId) {
            return res.json({ success: false, message: "User ID not found" });
        }

        const orders = await orderModel.find({ userId });
        res.json({ success: true, data: orders });
    } catch (error) {
        console.error("Error fetching user orders:", error);
        res.json({ success: false, message: "Error fetching orders" });
    }
}

//listing orders for admin panel
const listOrders = async (req, res) => {
    try {
        const orders = await orderModel.find({});
        res.json({ success: true, data: orders })
    } catch (error) {
        console.log(error);
        res.json({ success: false, message: "Error" })
    }
}

//api for updating order status
const updateStatus = async (req, res) => {
    try {
        await orderModel.findByIdAndUpdate(req.body.orderId, { status: req.body.status })
        res.json({ success: true, message: "Status Updated" })
    } catch (error) {
        console.log(error)
        res.json({ success: false, message: "Error" })
    }
}

export { placeOrder, verifyOrder, getUserOrders, listOrders, updateStatus }