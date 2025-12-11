import nodemailer from 'nodemailer';

// Create a transporter
// For development, we'll use Ethereal (fake SMTP service)
// For production, use environment variables for Gmail/SMTP
let transporter;

const setupTransporter = async () => {
  if (process.env.NODE_ENV === 'production') {
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });
  } else {
    // Generate test SMTP service account from ethereal.email
    try {
      const testAccount = await nodemailer.createTestAccount();
      
      transporter = nodemailer.createTransport({
        host: "smtp.ethereal.email",
        port: 587,
        secure: false, // true for 465, false for other ports
        auth: {
          user: testAccount.user, // generated ethereal user
          pass: testAccount.pass, // generated ethereal password
        },
      });
      console.log('📧 Email service initialized (Ethereal test mode)');
    } catch (err) {
      console.error('Failed to create test email account:', err);
    }
  }
};

// Initialize
setupTransporter();

// Email Templates
const templates = {
  jobReady: (customerName, vehicleCheck, jobRef) => ({
    subject: `Your vehicle is ready! - ${jobRef}`,
    text: `Hi ${customerName},\n\nGood news! Your ${vehicleCheck} is ready for pickup.\n\nJob Reference: ${jobRef}\n\nPlease visit us during business hours to collect your vehicle.\n\nThank you,\nKnight Auto Works`,
    html: `
      <div style="font-family: Arial, sans-serif; color: #333;">
        <h2 style="color: #f97316;">Vehicle Ready for Pickup</h2>
        <p>Hi ${customerName},</p>
        <p>Good news! Your <strong>${vehicleCheck}</strong> is ready for collection.</p>
        <p><strong>Job Reference:</strong> ${jobRef}</p>
        <p>Please visit us during business hours to pick up your vehicle.</p>
        <hr style="border: 1px solid #eee;">
        <p style="font-size: 12px; color: #666;">Knight Auto Works<br>Professional Auto Care Services</p>
      </div>
    `
  }),
  
  invoice: (customerName, vehicleCheck, invoiceNumber, amount, link) => ({
    subject: `Invoice #${invoiceNumber} from Knight Auto Works`,
    text: `Hi ${customerName},\n\nHere is your invoice for the recent work on your ${vehicleCheck}.\n\nInvoice: ${invoiceNumber}\nAmount Due: ${amount}\n\nYou can view the details here: ${link}\n\nThank you for your business!`,
    html: `
      <div style="font-family: Arial, sans-serif; color: #333;">
        <h2 style="color: #f97316;">Invoice Available</h2>
        <p>Hi ${customerName},</p>
        <p>Thank you for choosing Knight Auto Works. Here is your invoice for the recent work on your <strong>${vehicleCheck}</strong>.</p>
        <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 15px 0;">
          <p style="margin: 0;"><strong>Invoice:</strong> ${invoiceNumber}</p>
          <p style="margin: 5px 0 0;"><strong>Amount Due:</strong> ${amount}</p>
        </div>
        <p>Please arrange for payment at your earliest convenience.</p>
        <hr style="border: 1px solid #eee;">
        <p style="font-size: 12px; color: #666;">Knight Auto Works</p>
      </div>
    `
  })
};

export const sendEmail = async ({ to, type, data }) => {
  if (!transporter) await setupTransporter();
  
  if (!to) {
    throw new Error('No recipient email provided');
  }

  const templateGenerator = templates[type];
  if (!templateGenerator) {
    throw new Error(`Invalid email template type: ${type}`);
  }

  const { subject, text, html } = templateGenerator(...Object.values(data));

  const info = await transporter.sendMail({
    from: '"Knight Auto Works" <notifications@knightautoworks.com>',
    to,
    subject,
    text,
    html
  });

  console.log("Message sent: %s", info.messageId);
  // Preview only available when sending through an Ethereal account
  const previewUrl = nodemailer.getTestMessageUrl(info);
  console.log("Preview URL: %s", previewUrl);
  
  return { messageId: info.messageId, previewUrl };
};

export default { sendEmail };
