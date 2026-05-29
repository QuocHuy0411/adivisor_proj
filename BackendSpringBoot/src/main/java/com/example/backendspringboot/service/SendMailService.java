package com.example.backendspringboot.service;

import com.example.backendspringboot.exception.ErrorCode;
import com.example.backendspringboot.exception.MyAppException;
import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
@Slf4j
public class SendMailService {
    private final JavaMailSender mailSender;

    @Value("${app.smtp.from:${spring.mail.username:}}")
    private String smtpFrom;

    /**
     * Gửi mã OTP xác nhận đặt lại mật khẩu với giao diện HTML chuyên nghiệp, hiện đại.
     */
    @Async
    public void sendOtpMail(String to, String otp, long expiresInSeconds) {
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "utf-8");
            
            helper.setFrom(smtpFrom);
            helper.setTo(to);
            helper.setSubject("🔒 Mã OTP xác nhận khôi phục mật khẩu - Adivisor");

            String htmlBody = buildOtpTemplate(otp, expiresInSeconds);
            helper.setText(htmlBody, true); // true = HTML
            
            mailSender.send(message);
            log.info("Sent HTML OTP email successfully to: {}", to);
        } catch (MessagingException e) {
            log.error("Failed to send HTML OTP email to: {}", to, e);
            throw new MyAppException(ErrorCode.MAIL_SEND_FAILED);
        }
    }

    /**
     * Dựng template HTML với phong cách thiết kế hiện đại, responsive và trực quan.
     */
    private String buildOtpTemplate(String otp, long expiresInSeconds) {
        long minutes = expiresInSeconds / 60;
        
        return """
        <!DOCTYPE html>
        <html lang="vi">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Xác nhận OTP</title>
            <style>
                body {
                    margin: 0;
                    padding: 0;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                    background-color: #f4f6f9;
                    color: #334155;
                }
                .email-wrapper {
                    width: 100%%;
                    background-color: #f4f6f9;
                    padding: 40px 0;
                }
                .email-container {
                    max-width: 580px;
                    margin: 0 auto;
                    background-color: #ffffff;
                    border-radius: 16px;
                    overflow: hidden;
                    box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.05);
                    border: 1px solid #e2e8f0;
                }
                .email-header {
                    background: linear-gradient(135deg, #1e3a8a 0%%, #2563eb 50%%, #3b82f6 100%%);
                    padding: 35px 30px;
                    text-align: center;
                }
                .email-header h1 {
                    color: #ffffff;
                    margin: 0;
                    font-size: 26px;
                    font-weight: 800;
                    letter-spacing: 1px;
                    text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
                }
                .email-body {
                    padding: 40px 35px;
                    background-color: #ffffff;
                }
                .greeting {
                    font-size: 18px;
                    font-weight: 700;
                    color: #0f172a;
                    margin-top: 0;
                    margin-bottom: 16px;
                }
                .description {
                    font-size: 15px;
                    line-height: 1.6;
                    color: #475569;
                    margin-bottom: 35px;
                }
                .otp-box {
                    background: linear-gradient(180deg, #f8fafc 0%%, #f1f5f9 100%%);
                    border: 2px dashed #cbd5e1;
                    border-radius: 14px;
                    padding: 28px 20px;
                    text-align: center;
                    margin-bottom: 35px;
                    box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.02);
                }
                .otp-code {
                    font-size: 42px;
                    font-weight: 800;
                    color: #2563eb;
                    letter-spacing: 10px;
                    margin: 0 0 12px 0;
                    font-family: 'Courier New', Courier, monospace;
                    text-shadow: 0 1px 2px rgba(37, 99, 235, 0.1);
                }
                .timer-info {
                    font-size: 13.5px;
                    color: #64748b;
                    margin: 0;
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    font-weight: 500;
                }
                .alert-info {
                    background-color: #fffbeb;
                    border-left: 4px solid #f59e0b;
                    padding: 16px 20px;
                    border-radius: 4px 12px 12px 4px;
                    margin-bottom: 35px;
                }
                .alert-info p {
                    margin: 0;
                    font-size: 14px;
                    color: #b45309;
                    line-height: 1.5;
                    font-weight: 500;
                }
                .email-footer {
                    background-color: #f8fafc;
                    padding: 28px 30px;
                    text-align: center;
                    border-top: 1px solid #e2e8f0;
                }
                .footer-brand {
                    font-size: 13px;
                    font-weight: 700;
                    color: #475569;
                    margin: 0 0 8px 0;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }
                .footer-text {
                    font-size: 12px;
                    color: #94a3b8;
                    line-height: 1.6;
                    margin: 0;
                }
            </style>
        </head>
        <body>
            <div class="email-wrapper">
                <div class="email-container">
                    <div class="email-header">
                        <h1>ADIVISOR SYSTEM</h1>
                    </div>
                    <div class="email-body">
                        <p class="greeting">Xin chào,</p>
                        <p class="description">
                            Chúng tôi nhận được yêu cầu khôi phục mật khẩu tài khoản của bạn trên hệ thống <strong>Adivisor</strong>. 
                            Vui lòng sử dụng mã OTP (One-Time Password) dưới đây để tiến hành đặt lại mật khẩu của mình:
                        </p>
                        
                        <div class="otp-box">
                            <div class="otp-code">%s</div>
                            <p class="timer-info">
                                ⏱️ Mã này có hiệu lực trong vòng <strong>%d phút</strong>.
                            </p>
                        </div>
                        
                        <div class="alert-info">
                            <p>
                                ⚠️ <strong>Lưu ý bảo mật quan trọng:</strong> Vì sự an toàn của tài khoản, tuyệt đối không chia sẻ mã này cho bất kỳ ai. 
                                Nếu bạn không thực hiện yêu cầu này, vui lòng an tâm bỏ qua email này.
                            </p>
                        </div>
                    </div>
                    <div class="email-footer">
                        <p class="footer-brand">Hệ thống Cố vấn học tập - Adivisor</p>
                        <p class="footer-text">
                            Đây là email tự động. Vui lòng không trả lời trực tiếp email này.<br>
                            &copy; 2026 Adivisor. All rights reserved.
                        </p>
                    </div>
                </div>
            </div>
        </body>
        </html>
        """.formatted(otp, minutes);
    }
}

