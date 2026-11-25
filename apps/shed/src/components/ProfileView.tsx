import React, { useEffect, useState } from 'react';
import { Info } from 'lucide-react';
import {
  ACTIVITY_LEVELS,
  cmToFtIn,
  computeEnergy,
  ftInToCm,
  kgToLb,
  lbToKg,
  MAX_DEFICIT_SHARE,
  MIN_TARGET,
  type Activity,
  type Goal,
  type Pace,
  type Profile,
  type Sex,
  type Units,
} from '../lib/energy';
import { SITE } from '../config/site';
import { Segmented } from './Segmented';

interface ProfileViewProps {
  profile: Profile;
  onChange: (p: Profile) => void;
}

const toNum = (s: string): number | null => {
  const n = Number(s.replace(',', '.'));
  return s.trim() !== '' && Number.isFinite(n) ? n : null;
};
const show = (n: number | null, digits = 0): string =>
  n == null ? '' : String(Math.round(n * 10 ** digits) / 10 ** digits);

export const ProfileView: React.FC<ProfileViewProps> = ({ profile, onChange }) => {
  const imperial = profile.units === 'imperial';
  // Text state so people can type freely; synced into the profile as numbers.
  const [age, setAge] = useState(show(profile.age));
  const [heightCm, setHeightCm] = useState(show(profile.heightCm));
  const [ft, setFt] = useState(profile.heightCm ? String(cmToFtIn(profile.heightCm).ft) : '');
  const [inch, setInch] = useState(profile.heightCm ? String(cmToFtIn(profile.heightCm).inch) : '');
  const [weight, setWeight] = useState(
    profile.weightKg == null ? '' : imperial ? show(kgToLb(profile.weightKg)) : show(profile.weightKg, 1)
  );

  // Re-seed when the profile is replaced from outside (e.g. backup import).
  useEffect(() => {
    setAge(show(profile.age));
    setHeightCm(show(profile.heightCm));
    setFt(profile.heightCm ? String(cmToFtIn(profile.heightCm).ft) : '');
    setInch(profile.heightCm ? String(cmToFtIn(profile.heightCm).inch) : '');
    setWeight(profile.weightKg == null ? '' : profile.units === 'imperial' ? show(kgToLb(profile.weightKg)) : show(profile.weightKg, 1));
    // only when units or the stored identity changes, not on every keystroke
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.units]);

  const update = (patch: Partial<Profile>) => onChange({ ...profile, ...patch });
  const energy = computeEnergy(profile);

  const setUnits = (u: Units) => update({ units: u });

  const onHeightImperial = (nextFt: string, nextIn: string) => {
    setFt(nextFt);
    setInch(nextIn);
    const f = toNum(nextFt);
    const i = toNum(nextIn) ?? 0;
    update({ heightCm: f == null ? null : Math.round(ftInToCm(f, i) * 10) / 10 });
  };

  return (
    <div className="view">
      <h2 className="view-title">Profile</h2>

      <section className="card form-card" aria-labelledby="profile-body">
        <div className="card-head">
          <h3 id="profile-body" className="card-title">
            About you
          </h3>
          <Segmented<Units>
            label="Units"
            hideLabel
            value={profile.units}
            onChange={setUnits}
            options={[
              { value: 'imperial', label: 'lb / ft' },
              { value: 'metric', label: 'kg / cm' },
            ]}
          />
        </div>

        <Segmented<Sex>
          label="Sex (used by the formula)"
          value={profile.sex}
          onChange={(sex) => update({ sex })}
          options={[
            { value: 'female', label: 'Female' },
            { value: 'male', label: 'Male' },
          ]}
        />

        <div className="field-row">
          <label className="field">
            <span className="field-label">Age</span>
            <input
              className="input"
              inputMode="numeric"
              value={age}
              placeholder="years"
              onChange={(e) => {
                setAge(e.target.value);
                update({ age: toNum(e.target.value) });
              }}
            />
          </label>

          {imperial ? (
            <div className="field">
              <span className="field-label" id="height-label">
                Height
              </span>
              <div className="input-pair" role="group" aria-labelledby="height-label">
                <input
                  className="input"
                  inputMode="numeric"
                  aria-label="Feet"
                  placeholder="ft"
                  value={ft}
                  onChange={(e) => onHeightImperial(e.target.value, inch)}
                />
                <input
                  className="input"
                  inputMode="numeric"
                  aria-label="Inches"
                  placeholder="in"
                  value={inch}
                  onChange={(e) => onHeightImperial(ft, e.target.value)}
                />
              </div>
            </div>
          ) : (
            <label className="field">
              <span className="field-label">Height (cm)</span>
              <input
                className="input"
                inputMode="decimal"
                placeholder="cm"
                value={heightCm}
                onChange={(e) => {
                  setHeightCm(e.target.value);
                  update({ heightCm: toNum(e.target.value) });
                }}
              />
            </label>
          )}

          <label className="field">
            <span className="field-label">Weight ({imperial ? 'lb' : 'kg'})</span>
            <input
              className="input"
              inputMode="decimal"
              placeholder={imperial ? 'lb' : 'kg'}
              value={weight}
              onChange={(e) => {
                setWeight(e.target.value);
                const n = toNum(e.target.value);
                update({ weightKg: n == null ? null : Math.round((imperial ? lbToKg(n) : n) * 10) / 10 });
              }}
            />
          </label>
        </div>

        <label className="field">
          <span className="field-label">Activity level</span>
          <select
            className="input"
            value={profile.activity}
            onChange={(e) => update({ activity: e.target.value as Activity })}
          >
            {ACTIVITY_LEVELS.map((a) => (
              <option key={a.key} value={a.key}>
                {a.label} — {a.detail}
              </option>
            ))}
          </select>
        </label>

        <Segmented<Goal>
          label="Goal"
          value={profile.goal}
          onChange={(goal) => update({ goal })}
          options={[
            { value: 'lose', label: 'Lose' },
            { value: 'maintain', label: 'Maintain' },
            { value: 'gain', label: 'Gain' },
          ]}
        />
        {profile.goal !== 'maintain' && (
          <Segmented<Pace>
            label="Pace"
            value={profile.pace}
            onChange={(pace) => update({ pace })}
            options={[
              { value: 'gentle', label: profile.goal === 'lose' ? 'Gentle (−250/day)' : 'Gentle (+250/day)' },
              { value: 'steady', label: profile.goal === 'lose' ? 'Steady (−500/day)' : 'Steady (+500/day)' },
            ]}
          />
        )}
      </section>

      <section className="card result-card" aria-labelledby="profile-result" aria-live="polite">
        <h3 id="profile-result" className="card-title">
          Your daily target
        </h3>
        {energy ? (
          <>
            <p className="result-big">
              {energy.target.toLocaleString()} <span className="summary-unit">kcal / day</span>
            </p>
            <dl className="result-grid">
              <div>
                <dt>Resting (BMR)</dt>
                <dd>{energy.bmr.toLocaleString()}</dd>
              </div>
              <div>
                <dt>Maintenance (TDEE)</dt>
                <dd>{energy.tdee.toLocaleString()}</dd>
              </div>
              <div>
                <dt>Goal adjustment</dt>
                <dd>
                  {energy.adjustment > 0 ? '+' : energy.adjustment < 0 ? '−' : ''}
                  {Math.abs(energy.adjustment).toLocaleString()}
                </dd>
              </div>
            </dl>
            {energy.limitedBy === 'deficit-cap' && (
              <p className="note">
                <Info size={14} aria-hidden="true" /> Deficit capped at {Math.round(MAX_DEFICIT_SHARE * 100)}% below
                maintenance.
              </p>
            )}
            {energy.limitedBy === 'floor' && (
              <p className="note">
                <Info size={14} aria-hidden="true" /> Target kept at or above {MIN_TARGET[profile.sex].toLocaleString()} kcal,
                a common minimum without medical supervision.
              </p>
            )}
          </>
        ) : (
          <p className="muted">Enter your age, height, and weight to see your target.</p>
        )}
        <p className="disclaimer">{SITE.disclaimer}</p>
      </section>
    </div>
  );
};
