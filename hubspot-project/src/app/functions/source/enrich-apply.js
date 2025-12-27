const axios = require('axios');

const validateProperty = async (objectType, token, propName) => {
    try {
        await axios.get(`https://api.hubapi.com/crm/v3/properties/${objectType}/${propName}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        return true;
    } catch (e) {
        return false;
    }
};

const filterExistingProperties = async (objectType, token, updates) => {
  const entries = Object.entries(updates || {});
  const allowed = {};
  for (const [key, value] of entries) {
    if (await validateProperty(objectType, token, key)) {
      allowed[key] = value;
    }
  }
  return allowed;
};

exports.main = async (context = {}) => {
  const token = process.env['PRIVATE_APP_ACCESS_TOKEN'];
  if (!token) throw new Error('Missing PRIVATE_APP_ACCESS_TOKEN');

  const { contactId, companyId, contactUpdates, companyUpdates, noteBody } = context.parameters || {};
  if (!contactId) return { statusCode: 400, body: { error: 'Missing contactId' } };

  try {
    const applied = {
      contact: null,
      company: null,
      note: null
    };

    // 1. Update Contact
    const safeContactUpdates = await filterExistingProperties('contacts', token, contactUpdates || {});
    if (Object.keys(safeContactUpdates).length > 0) {
      await axios.patch(`https://api.hubapi.com/crm/v3/objects/contacts/${contactId}`, 
        { properties: safeContactUpdates },
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      applied.contact = safeContactUpdates;
    }

    // 2. Update Company
    if (companyId) {
        const safeCompanyUpdates = await filterExistingProperties('companies', token, companyUpdates || {});
        if (Object.keys(safeCompanyUpdates).length > 0) {
            await axios.patch(`https://api.hubapi.com/crm/v3/objects/companies/${companyId}`, 
                { properties: safeCompanyUpdates },
                { headers: { 'Authorization': `Bearer ${token}` } }
            );
            applied.company = safeCompanyUpdates;
        }
    }

    // 3. Create Note (V3)
    if (noteBody) {
      await axios.post('https://api.hubapi.com/crm/v3/objects/notes', {
        properties: {
            hs_timestamp: Date.now(),
            hs_note_body: noteBody
        },
        associations: [
            {
                to: { id: contactId },
                types: [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: 202 }] // 202: Contact to Note
            }
        ]
      }, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      applied.note = true;
    }

    return { statusCode: 200, body: { applied } };

  } catch (error) {
    console.error('Apply error:', error.response?.data || error.message);
    return { statusCode: 500, body: { error: 'Apply failed', details: error.response?.data } };
  }
};
