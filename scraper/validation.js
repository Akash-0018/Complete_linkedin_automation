// Data validation and processing utilities
const validator = require('validator');
const libphonenumber = require('google-libphonenumber');
const phoneUtil = libphonenumber.PhoneNumberUtil.getInstance();

// Regular expressions for data extraction
const EMAIL_REGEX = /[\w._%+-]+@[\w.-]+\.[a-zA-Z]{2,}/g;
const PHONE_REGEX = /(?:(?:\+?\d{1,3}[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4})/g;

// Profile data validation and cleaning
function validateEmail(email) {
  return validator.isEmail(email) ? email : null;
}

function formatPhoneNumber(phone, defaultCountry = 'US') {
  try {
    const number = phoneUtil.parseAndKeepRawInput(phone, defaultCountry);
    if (phoneUtil.isValidNumber(number)) {
      return phoneUtil.format(number, libphonenumber.PhoneNumberFormat.INTERNATIONAL);
    }
  } catch (error) {
    return null;
  }
  return null;
}

function extractContactInfo(text) {
  const emails = text.match(EMAIL_REGEX) || [];
  const phones = text.match(PHONE_REGEX) || [];
  
  return {
    emails: [...new Set(emails)].filter(e => validateEmail(e)),
    phones: [...new Set(phones)].map(p => formatPhoneNumber(p)).filter(Boolean)
  };
}

function validateProfile(profile) {
  const required = ['name', 'title', 'location'];
  const isValid = required.every(field => profile[field] && profile[field].trim());
  
  if (!isValid) {
    throw new Error('Missing required profile fields');
  }
  
  // Extract additional contact info from about/experience sections
  const aboutInfo = extractContactInfo(profile.about || '');
  const expInfo = extractContactInfo(profile.experience || '');
  
  return {
    ...profile,
    email: profile.email || aboutInfo.emails[0] || expInfo.emails[0] || '',
    phone: profile.phone || aboutInfo.phones[0] || expInfo.phones[0] || '',
    additionalEmails: [...aboutInfo.emails, ...expInfo.emails].filter(e => e !== profile.email),
    additionalPhones: [...aboutInfo.phones, ...expInfo.phones].filter(p => p !== profile.phone)
  };
}

// Data deduplication
class ProfileDeduplicator {
  constructor() {
    this.profiles = new Map();
  }

  generateKey(profile) {
    return `${profile.name}|${profile.title}|${profile.location}`.toLowerCase();
  }

  isDuplicate(profile) {
    return this.profiles.has(this.generateKey(profile));
  }

  addProfile(profile) {
    const key = this.generateKey(profile);
    if (!this.profiles.has(key)) {
      this.profiles.set(key, profile);
      return true;
    }
    return false;
  }

  mergeProfile(newProfile) {
    const key = this.generateKey(newProfile);
    if (this.profiles.has(key)) {
      const existing = this.profiles.get(key);
      const merged = {
        ...existing,
        email: newProfile.email || existing.email,
        phone: newProfile.phone || existing.phone,
        additionalEmails: [...new Set([
          ...(existing.additionalEmails || []),
          ...(newProfile.additionalEmails || [])
        ])],
        additionalPhones: [...new Set([
          ...(existing.additionalPhones || []),
          ...(newProfile.additionalPhones || [])
        ])]
      };
      this.profiles.set(key, merged);
      return merged;
    }
    this.profiles.set(key, newProfile);
    return newProfile;
  }
}

module.exports = {
  validateEmail,
  formatPhoneNumber,
  extractContactInfo,
  validateProfile,
  ProfileDeduplicator
};