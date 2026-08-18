const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const sendEmail = async (to, subject, html) => {
  if (process.env.NODE_ENV === 'test' || !process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    if (process.env.NODE_ENV !== 'test') {
      console.warn('SMTP not configured or running in test mode; skipping email send.');
    }
    return { messageId: 'test-email-skip' };
  }

  try {
    const mailOptions = {
      from: process.env.SMTP_FROM,
      to,
      subject,
      html,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent:', info.messageId);
    return info;
  } catch (error) {
    console.error('Error sending email:', error);
    throw error;
  }
};

const sendWelcomeEmail = async (user) => {
  const subject = 'Welcome to AgroConnect!';
  const html = `
    <h1>Welcome ${user.firstName}!</h1>
    <p>Thank you for joining AgroConnect. Your account has been created successfully.</p>
    <p>You can now start buying and selling agricultural products.</p>
    <br>
    <p>Best regards,<br>AgroConnect Team</p>
  `;
  return sendEmail(user.email, subject, html);
};

const sendOrderConfirmation = async (order, user) => {
  const subject = 'Order Confirmation - AgroConnect';
  const html = `
    <h1>Order Confirmed!</h1>
    <p>Dear ${user.firstName},</p>
    <p>Your order #${order._id} has been placed successfully.</p>
    <p>Order Details:</p>
    <ul>
      ${order.items.map(item => `<li>${item.product.name} - ${item.quantity}kg - ₹${item.price}</li>`).join('')}
    </ul>
    <p>Total: ₹${order.totalAmount}</p>
    <br>
    <p>Best regards,<br>AgroConnect Team</p>
  `;
  return sendEmail(user.email, subject, html);
};

const sendDeliveryUpdate = async (delivery, user) => {
  const subject = 'Delivery Update - AgroConnect';
  const html = `
    <h1>Delivery Update</h1>
    <p>Dear ${user.firstName},</p>
    <p>Your delivery #${delivery.deliveryNumber} status has been updated to: ${delivery.status}</p>
    <p>Estimated delivery time: ${delivery.deliveryDuration} minutes</p>
    <br>
    <p>Best regards,<br>AgroConnect Team</p>
  `;
  return sendEmail(user.email, subject, html);
};

const sendPasswordResetEmail = async (email, resetUrl) => {
  const subject = 'Password Reset Request - AgroConnect';
  const html = `
    <h1>Password Reset Request</h1>
    <p>We received a request to reset your password for your AgroConnect account.</p>
    <p>Please click the link below to reset your password. This link is valid for 1 hour.</p>
    <p><a href="${resetUrl}" style="background-color: #009933; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; display: inline-block;">Reset Password</a></p>
    <p>If you didn't request a password reset, you can safely ignore this email.</p>
    <br>
    <p>Best regards,<br>AgroConnect Team</p>
  `;
  return sendEmail(email, subject, html);
};

module.exports = {
  sendEmail,
  sendWelcomeEmail,
  sendOrderConfirmation,
  sendDeliveryUpdate,
  sendPasswordResetEmail,
};