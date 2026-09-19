type Mail = { to:string; subject:string; text:string };

export async function sendMail(mail:Mail) {
  const key=process.env.RESEND_API_KEY;
  const from=process.env.EMAIL_FROM;
  if(!key || !from) {
    if(process.env.NODE_ENV!=="production") console.info(`[SmartBanca e-mail local] ${mail.subject}: ${mail.text}`);
    return false;
  }
  const response=await fetch("https://api.resend.com/emails",{method:"POST",headers:{Authorization:`Bearer ${key}`,"Content-Type":"application/json"},body:JSON.stringify({from,to:[mail.to],subject:mail.subject,text:mail.text})});
  if(!response.ok) throw new Error("Falha ao enviar e-mail.");
  return true;
}
