import {
  DWELLING_TYPES,
  URUGUAY_COUNTRY,
  URUGUAY_DEPARTMENTS,
} from '../shared/customer-profile.js';

export function createEmptyCustomerAddress() {
  return {
    label: 'Envío principal',
    addressLine: '',
    city: '',
    state: '',
    country: URUGUAY_COUNTRY,
    postalCode: '',
    dwellingType: DWELLING_TYPES.HOUSE,
    apartment: '',
    deliveryNotes: '',
  };
}

export default function CustomerProfileFields({
  profile,
  onChange,
  validationPrefix = 'customer',
  emailReadOnly = false,
  showDeliveryNotes = true,
}) {
  const address = profile.defaultAddress || createEmptyCustomerAddress();

  function updateField(name, value) {
    onChange({ ...profile, [name]: value });
  }

  function updateAddress(name, value) {
    const nextAddress = { ...address, [name]: value };
    if (name === 'dwellingType' && value === DWELLING_TYPES.HOUSE) {
      nextAddress.apartment = '';
    }
    onChange({ ...profile, defaultAddress: nextAddress });
  }

  return (
    <div className="form-grid-two">
      <label className="field-group">
        <span>Nombre *</span>
        <input
          className="input"
          name="firstName"
          data-validation-field={`${validationPrefix}-first-name`}
          value={profile.firstName || ''}
          onChange={(event) => updateField('firstName', event.target.value)}
          required
        />
      </label>
      <label className="field-group">
        <span>Apellido *</span>
        <input
          className="input"
          name="lastName"
          data-validation-field={`${validationPrefix}-last-name`}
          value={profile.lastName || ''}
          onChange={(event) => updateField('lastName', event.target.value)}
          required
        />
      </label>
      <label className="field-group">
        <span>Email *</span>
        <input
          className="input"
          type="email"
          name="email"
          data-validation-field={`${validationPrefix}-email`}
          value={profile.email || ''}
          onChange={(event) => updateField('email', event.target.value)}
          readOnly={emailReadOnly}
          required
        />
      </label>
      <label className="field-group">
        <span>Celular *</span>
        <input
          className="input"
          name="phone"
          inputMode="tel"
          autoComplete="tel"
          placeholder="099123456"
          data-validation-field={`${validationPrefix}-phone`}
          value={profile.phone || ''}
          onChange={(event) => updateField('phone', event.target.value)}
          required
        />
      </label>
      <label className="field-group form-grid-span-two">
        <span>Dirección *</span>
        <input
          className="input"
          name="addressLine"
          autoComplete="street-address"
          data-validation-field={`${validationPrefix}-address-line`}
          value={address.addressLine || ''}
          onChange={(event) => updateAddress('addressLine', event.target.value)}
          required
        />
      </label>
      <label className="field-group">
        <span>Ciudad *</span>
        <input
          className="input"
          name="city"
          data-validation-field={`${validationPrefix}-city`}
          value={address.city || ''}
          onChange={(event) => updateAddress('city', event.target.value)}
          required
        />
      </label>
      <label className="field-group">
        <span>Departamento *</span>
        <select
          className="input"
          name="state"
          data-validation-field={`${validationPrefix}-state`}
          value={address.state || ''}
          onChange={(event) => updateAddress('state', event.target.value)}
          required
        >
          <option value="">Seleccionar departamento</option>
          {URUGUAY_DEPARTMENTS.map((department) => (
            <option key={department} value={department}>{department}</option>
          ))}
        </select>
      </label>
      <label className="field-group">
        <span>País *</span>
        <input className="input" name="country" value={URUGUAY_COUNTRY} readOnly required />
      </label>
      <label className="field-group">
        <span>Código postal *</span>
        <input
          className="input"
          name="postalCode"
          data-validation-field={`${validationPrefix}-postal-code`}
          value={address.postalCode || ''}
          onChange={(event) => updateAddress('postalCode', event.target.value)}
          required
        />
      </label>
      <label className="field-group">
        <span>Tipo de vivienda *</span>
        <select
          className="input"
          name="dwellingType"
          data-validation-field={`${validationPrefix}-dwelling-type`}
          value={address.dwellingType || ''}
          onChange={(event) => updateAddress('dwellingType', event.target.value)}
          required
        >
          <option value={DWELLING_TYPES.HOUSE}>Casa</option>
          <option value={DWELLING_TYPES.APARTMENT}>Apartamento</option>
        </select>
      </label>
      {address.dwellingType === DWELLING_TYPES.APARTMENT ? (
        <label className="field-group">
          <span>Apartamento *</span>
          <input
            className="input"
            name="apartment"
            data-validation-field={`${validationPrefix}-apartment`}
            value={address.apartment || ''}
            onChange={(event) => updateAddress('apartment', event.target.value)}
            required
          />
        </label>
      ) : null}
      {showDeliveryNotes ? (
        <label className="field-group form-grid-span-two">
          <span>Indicaciones de entrega</span>
          <textarea
            className="input"
            name="deliveryNotes"
            value={address.deliveryNotes || ''}
            onChange={(event) => updateAddress('deliveryNotes', event.target.value)}
            rows="3"
          />
        </label>
      ) : null}
    </div>
  );
}
