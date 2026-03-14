import emailUtils from '../utils/email-utils';
import otpUtils from '../utils/otp-utils';

export default function emailMsgTemplate(email, tgMsgTo, tgMsgFrom, tgMsgText) {

	const plainText = emailUtils.formatText(email.text) || emailUtils.htmlToText(email.content);
	const otpCode = otpUtils.extractOtp(email.subject, plainText);

	// If OTP detected, wrap it with <code> inline within subject
	const displaySubject = otpCode
		? email.subject.replace(otpCode, `<code>${otpCode}</code>`)
		: email.subject;

	let template = `<b>${displaySubject}</b>`

		if (tgMsgFrom === 'only-name') {
			template += `

From\u200B：${email.name}`
		}

		if (tgMsgFrom === 'show') {
			template += `

From\u200B：${email.name}  &lt;${email.sendEmail}&gt;`
		}

		if(tgMsgTo === 'show' && tgMsgFrom === 'hide') {
			template += `

To：\u200B${email.toEmail}`

		} else if(tgMsgTo === 'show') {
		template += `
To：\u200B${email.toEmail}`
	}

	let text = plainText
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;');

	// If OTP detected, wrap it with <code> inline within body text
	if (otpCode) {
		text = text.replace(otpCode, `<code>${otpCode}</code>`);
	}

	if(tgMsgText === 'show') {
		template += `

${text}`
	}

	return template;

}
