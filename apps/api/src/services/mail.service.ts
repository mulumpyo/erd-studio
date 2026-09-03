import { Injectable, Logger } from '@nestjs/common'
import * as nodemailer from 'nodemailer'
import type { Transporter } from 'nodemailer'

export type InviteMail = {
  to: string
  inviterName: string
  workspaceName: string
  roleLabel: string
  url: string
  expiresAt: Date
}

export type VerifyMail = {
  to: string
  name: string
  url: string
  expiresAt: Date
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name)
  private transporter: Transporter | null = null

  isConfigured = () => Boolean(process.env.SMTP_HOST)

  private transport = () => {
    if (this.transporter) return this.transporter
    const host = process.env.SMTP_HOST
    if (!host) return null
    const port = Number(process.env.SMTP_PORT ?? 587)
    this.transporter = (
      nodemailer.createTransport ??
      (nodemailer as unknown as { default: typeof nodemailer }).default
        .createTransport
    )({
      host,
      port,
      secure: process.env.SMTP_SECURE === 'true' || port === 465,
      auth:
        process.env.SMTP_USER && process.env.SMTP_PASS
          ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
          : undefined,
    })
    return this.transporter
  }

  private fromAddress = () => {
    const from = process.env.MAIL_FROM?.trim()
    if (from && !/@localhost\b/i.test(from)) return from
    const user = process.env.SMTP_USER?.trim()
    if (!user) return from || '"ERD Studio" <noreply@localhost>'
    const address = user.includes('@')
      ? user
      : process.env.SMTP_HOST?.includes('kakao.com')
        ? `${user}@kakao.com`
        : null
    return address ? `"ERD Studio" <${address}>` : from || `"ERD Studio" <${user}>`
  }

  private deliver = async (mail: {
    to: string
    subject: string
    text: string
    html: string
    url: string
    kind: string
  }) => {
    const from = this.fromAddress()
    const transport = this.transport()
    if (!transport) {
      this.logger.log(
        `SMTP 없음. ${mail.kind}을 건너뜁니다.`,
      )
      return false
    }
    try {
      await transport.sendMail({
        from,
        to: mail.to,
        subject: mail.subject,
        text: mail.text,
        html: mail.html,
      })
      return true
    } catch (error) {
      this.logger.error(
        `${mail.kind}을 보내지 못했어요: ${error instanceof Error ? error.message : 'unknown'}`,
      )
      return false
    }
  }

  sendInvite = async (mail: InviteMail) => {
    const subject = `${mail.inviterName}님이 ${mail.workspaceName}에 초대했어요`
    const until = mail.expiresAt.toLocaleDateString('ko-KR')
    const text = [
      `${mail.inviterName}님이 ERD Studio의 ${mail.workspaceName}에 초대했어요.`,
      `${mail.roleLabel} 권한으로 함께할 수 있어요.`,
      '',
      '아래 링크에서 가입하거나 로그인한 뒤 참여해 주세요.',
      mail.url,
      '',
      `이 링크는 ${until}까지 유효해요.`,
    ].join('\n')
    const html = inviteHtml({
      inviterName: escapeHtml(mail.inviterName),
      workspaceName: escapeHtml(mail.workspaceName),
      roleLabel: escapeHtml(mail.roleLabel),
      url: escapeHtml(mail.url),
      until,
    })
    return this.deliver({
      to: mail.to,
      subject,
      text,
      html,
      url: mail.url,
      kind: '초대 메일',
    })
  }

  sendVerify = async (mail: VerifyMail) => {
    const subject = '이메일 인증을 완료해 주세요'
    const until = mail.expiresAt.toLocaleString('ko-KR')
    const text = [
      `${mail.name}님, ERD Studio 가입을 환영해요.`,
      '아래 링크에서 이메일 인증을 완료해 주세요.',
      mail.url,
      '',
      `이 링크는 ${until}까지 유효해요.`,
    ].join('\n')
    const html = verifyHtml({
      name: escapeHtml(mail.name),
      url: escapeHtml(mail.url),
      until,
    })
    return this.deliver({
      to: mail.to,
      subject,
      text,
      html,
      url: mail.url,
      kind: '인증 메일',
    })
  }

  sendReset = async (mail: VerifyMail) => {
    const subject = '비밀번호를 재설정해 주세요'
    const until = mail.expiresAt.toLocaleString('ko-KR')
    const text = [
      `${mail.name}님, 비밀번호 재설정을 요청했어요.`,
      '아래 링크에서 새 비밀번호를 설정해 주세요.',
      mail.url,
      '',
      `이 링크는 ${until}까지 유효해요.`,
    ].join('\n')
    const html = resetHtml({
      name: escapeHtml(mail.name),
      url: escapeHtml(mail.url),
      until,
    })
    return this.deliver({
      to: mail.to,
      subject,
      text,
      html,
      url: mail.url,
      kind: '비밀번호 재설정 메일',
    })
  }
}

const font =
  'Pretendard,Apple SD Gothic Neo,Malgun Gothic,sans-serif'

const inviteHtml = (mail: {
  inviterName: string
  workspaceName: string
  roleLabel: string
  url: string
  until: string
}) => `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>초대</title>
</head>
<body style="margin:0;padding:0;background:#f2f4f6;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f2f4f6;">
  <tr>
    <td align="center" style="padding:48px 16px;">
      <table role="presentation" width="400" cellpadding="0" cellspacing="0" style="width:400px;max-width:100%;">
        <tr>
          <td style="padding:0 8px 28px;font-family:${font};font-size:15px;font-weight:700;letter-spacing:-0.03em;color:#191f28;">
            <span style="display:inline-block;width:22px;height:22px;line-height:22px;margin-right:8px;border-radius:7px;background:#3182f6;color:#fff;font-size:12px;text-align:center;vertical-align:middle;">E</span>
            <span style="vertical-align:middle;">ERD Studio</span>
          </td>
        </tr>
        <tr>
          <td style="padding:36px 32px 32px;background:#ffffff;border-radius:24px;">
            <p style="margin:0 0 10px;font-family:${font};font-size:13px;font-weight:600;letter-spacing:-0.02em;color:#3182f6;">초대</p>
            <h1 style="margin:0 0 16px;font-family:${font};font-size:26px;font-weight:700;line-height:1.35;letter-spacing:-0.04em;color:#191f28;">
              ${mail.workspaceName}에<br />초대했어요
            </h1>
            <p style="margin:0 0 28px;font-family:${font};font-size:15px;line-height:1.6;letter-spacing:-0.02em;color:#4e5968;">
              ${mail.inviterName}님이 ${mail.roleLabel} 권한으로 함께하자고 했어요. 버튼을 눌러 가입하거나 로그인해 주세요.
            </p>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td>
                  <a href="${mail.url}" style="display:block;background:#3182f6;color:#ffffff;text-decoration:none;padding:14px 20px;border-radius:14px;font-family:${font};font-size:16px;font-weight:700;letter-spacing:-0.02em;text-align:center;">
                    초대 수락하기
                  </a>
                </td>
              </tr>
            </table>
            <p style="margin:20px 0 0;font-family:${font};font-size:13px;line-height:1.5;letter-spacing:-0.01em;color:#8b95a1;">
              이 링크는 ${mail.until}까지 유효해요.
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:24px 8px 0;font-family:${font};font-size:12px;line-height:1.5;letter-spacing:-0.01em;color:#adb5bd;">
            버튼을 누를 수 없다면 아래 주소를 브라우저에 붙여 넣어 주세요.<br />
            ${mail.url}
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`

const verifyHtml = (mail: {
  name: string
  url: string
  until: string
}) => actionEmailHtml({
  kicker: '이메일 인증',
  title: '가입을 완료해 주세요',
  body: `${mail.name}님, 버튼을 누르면 이메일 인증이 끝나고 ERD Studio를 바로 쓸 수 있어요.`,
  cta: '이메일 인증하기',
  url: mail.url,
  until: mail.until,
})

const resetHtml = (mail: {
  name: string
  url: string
  until: string
}) => actionEmailHtml({
  kicker: '비밀번호 재설정',
  title: '새 비밀번호를 설정해 주세요',
  body: `${mail.name}님, 버튼을 누르면 비밀번호를 바꿀 수 있어요. 요청하지 않았다면 이 메일을 무시해 주세요.`,
  cta: '비밀번호 재설정',
  url: mail.url,
  until: mail.until,
})

const actionEmailHtml = (mail: {
  kicker: string
  title: string
  body: string
  cta: string
  url: string
  until: string
}) => `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${mail.kicker}</title>
</head>
<body style="margin:0;padding:0;background:#f2f4f6;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f2f4f6;">
  <tr>
    <td align="center" style="padding:48px 16px;">
      <table role="presentation" width="400" cellpadding="0" cellspacing="0" style="width:400px;max-width:100%;">
        <tr>
          <td style="padding:0 8px 28px;font-family:${font};font-size:15px;font-weight:700;letter-spacing:-0.03em;color:#191f28;">
            <span style="display:inline-block;width:22px;height:22px;line-height:22px;margin-right:8px;border-radius:7px;background:#3182f6;color:#fff;font-size:12px;text-align:center;vertical-align:middle;">E</span>
            <span style="vertical-align:middle;">ERD Studio</span>
          </td>
        </tr>
        <tr>
          <td style="padding:36px 32px 32px;background:#ffffff;border-radius:24px;">
            <p style="margin:0 0 10px;font-family:${font};font-size:13px;font-weight:600;letter-spacing:-0.02em;color:#3182f6;">${mail.kicker}</p>
            <h1 style="margin:0 0 16px;font-family:${font};font-size:26px;font-weight:700;line-height:1.35;letter-spacing:-0.04em;color:#191f28;">
              ${mail.title}
            </h1>
            <p style="margin:0 0 28px;font-family:${font};font-size:15px;line-height:1.6;letter-spacing:-0.02em;color:#4e5968;">
              ${mail.body}
            </p>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td>
                  <a href="${mail.url}" style="display:block;background:#3182f6;color:#ffffff;text-decoration:none;padding:14px 20px;border-radius:14px;font-family:${font};font-size:16px;font-weight:700;letter-spacing:-0.02em;text-align:center;">
                    ${mail.cta}
                  </a>
                </td>
              </tr>
            </table>
            <p style="margin:20px 0 0;font-family:${font};font-size:13px;line-height:1.5;letter-spacing:-0.01em;color:#8b95a1;">
              이 링크는 ${mail.until}까지 유효해요.
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:24px 8px 0;font-family:${font};font-size:12px;line-height:1.5;letter-spacing:-0.01em;color:#adb5bd;">
            버튼을 누를 수 없다면 아래 주소를 브라우저에 붙여 넣어 주세요.<br />
            ${mail.url}
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`

const escapeHtml = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
