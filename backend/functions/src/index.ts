import * as functions from "firebase-functions";
import * as nodemailer from "nodemailer";

// Configurações do remetente (exemplo com Gmail)
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "markfy.suporte@gmail.com",
    pass: "nkxi zedg iniv vwzz",
  },
});

// Função HTTPS que envia o e-mail
exports.sendVerificationCode = functions.https.onRequest(async (req, res) => {
  const {email, code} = req.body;

  if (!email || !code) {
    res.status(400).send("Email e código são obrigatórios.");
  }

  const mailOptions = {
    from: "\"Markfy\" <markfy.suporte@gmail.com>",
    to: email,
    subject: "Seu código de verificação",
    html: `<p>Olá! Seu código de verificação é:</p><h2>${code}</h2>`,
  };

  try {
    await transporter.sendMail(mailOptions);
    res.status(200).send("Email enviado com sucesso.");
  } catch (error) {
    console.error("Erro ao enviar email:", error);
    res.status(500).send("Erro ao enviar email.");
  }
});
