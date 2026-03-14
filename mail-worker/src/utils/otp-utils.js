/**
 * OTP / Verification Code detection utility
 *
 * Extracts OTP codes from email subject and body text.
 * Supports multiple languages (EN, ZH-TW, ZH-CN, JA) and common patterns.
 */

const OTP_PATTERNS = [
	// ── English patterns ──
	/(?:verification\s*code|verify\s*code|otp|one[- ]?time\s*(?:password|passcode|code)|passcode|security\s*code|auth(?:entication)?\s*code|confirm(?:ation)?\s*code|login\s*code|access\s*code|sign[- ]?in\s*code|2fa\s*code|mfa\s*code|pin\s*code)[\s:：is]+([A-Za-z0-9]{4,8})/i,
	// "code: 123456" or "code is 123456"
	/\bcode[\s:：]+([A-Za-z0-9]{4,8})\b/i,
	// "Your code is: 123456" / "Your code: 123456"
	/\byour\s+code\s+(?:is\s*)?[:：]?\s*([A-Za-z0-9]{4,8})\b/i,
	// "use 123456 to verify" / "enter 123456"
	/\b(?:use|enter|input|type|submit)\s+([A-Za-z0-9]{4,8})\s+(?:to\s+)?(?:verify|confirm|log\s*in|sign\s*in|complete|validate|authenticate)/i,
	// ── Chinese (Traditional + Simplified) ──
	/(?:驗證碼|驗證|验证|验证码|確認碼|确认码|安全碼|安全码|動態密碼|动态密码|登入碼|登录码)[\s:：為为是]+([A-Za-z0-9]{4,8})/,
	// ── Japanese ──
	/(?:認証コード|確認コード|ワンタイムパスワード|セキュリティコード|検証コード)[\s:：は]+([A-Za-z0-9]{4,8})/,
	// ── Korean ──
	/(?:인증\s*코드|확인\s*코드|보안\s*코드)[\s:：]+([A-Za-z0-9]{4,8})/,
	// ── Standalone prominent number (last resort) ──
	// Matches a 4-8 digit number that appears on its own line or surrounded by whitespace
	/^\s*(\d{4,8})\s*$/m,
];

const otpUtils = {

	/**
	 * Attempt to extract an OTP / verification code from email subject and body.
	 *
	 * @param {string} subject - Email subject line
	 * @param {string} text    - Plain-text body of the email
	 * @returns {string|null}  - The extracted code, or null if none found
	 */
	extractOtp(subject, text) {
		// Try subject first – many OTP emails put the code right in the subject
		const fromSubject = this._matchCode(subject);
		if (fromSubject) return fromSubject;

		// Then try body text
		const fromBody = this._matchCode(text);
		if (fromBody) return fromBody;

		return null;
	},

	/**
	 * @private
	 * Run through all patterns against the given string.
	 */
	_matchCode(str) {
		if (!str) return null;
		for (const pattern of OTP_PATTERNS) {
			const match = str.match(pattern);
			if (match && match[1]) {
				return match[1];
			}
		}
		return null;
	}
};

export default otpUtils;
