import { useState } from 'react';
import './Legal.css';

const CONTACT = 'tyler.fennelly06@gmail.com';
const EFFECTIVE = 'August 15, 2026';

const TABS = [
  { id: 'privacy', label: 'Privacy' },
  { id: 'terms', label: 'Terms' },
  { id: 'safety', label: 'Safety' },
];

function Privacy() {
  return (
    <>
      <h2>Privacy Policy</h2>
      <p className="lg-eff">Effective {EFFECTIVE}</p>
      <p>Roam is an independent app that scores runs on fun. This policy explains what we collect and how we handle it. We try to collect as little as possible and never sell your data.</p>

      <h3>What we collect</h3>
      <ul>
        <li><b>Account:</b> your email, a password (stored securely by our authentication provider — we never see it), your display name, username, and an optional profile photo.</li>
        <li><b>Activity:</b> your runs — GPS route, distance, duration, points, streets explored, moods, and any spots or quests.</li>
        <li><b>Location:</b> while you use the map or record a run, we access your device location <i>with your permission</i>. You can turn this off in your device settings, but the app needs it to track a run.</li>
        <li><b>Basic technical data</b> needed to keep the app running.</li>
      </ul>

      <h3>How we use it</h3>
      <ul>
        <li><b>To run the app:</b> show your maps, trail, stats, and patches, and sync them across your devices.</li>
        <li><b>Social features you choose:</b> friends see your name, photo, and points; groups show leaderboards; live “run together” shares your location in real time only with people in that session.</li>
        <li><b>Community map:</b> your runs contribute to a shared map, but only in <b>anonymized</b> form — no name or account attached, and the start and end of each route are trimmed so a run can’t be traced back to your home.</li>
      </ul>

      <h3>Who we share it with</h3>
      <ul>
        <li>We <b>do not sell</b> your data.</li>
        <li><b>Service providers</b> that operate the app: Supabase (database, login, photo storage). Map imagery comes from OpenStreetMap and CARTO. If you connect Strava, we exchange data with Strava at your request.</li>
        <li><b>Friends and groups</b> see what you’d expect — your name, photo, and points.</li>
        <li><b>Legal reasons</b> — only if required by law.</li>
      </ul>

      <h3>Storage & security</h3>
      <p>Your data is stored with Supabase. Passwords are hashed by our login provider. Access to your data is restricted by row-level security so people can only see what they’re meant to.</p>

      <h3>Your choices</h3>
      <p>You can edit your profile anytime and reset your map from the map screen. To delete your account and data, email us at {CONTACT}. Depending on where you live (for example California or the EU), you may have rights to access, correct, or delete your data — email us and we’ll help.</p>

      <h3>Children</h3>
      <p>Roam is intended for people 13 and older (and really designed for adults). We don’t knowingly collect data from children under 13.</p>

      <h3>Changes</h3>
      <p>We may update this policy; we’ll change the date at the top when we do.</p>

      <h3>Contact</h3>
      <p>Questions? Email {CONTACT}.</p>
    </>
  );
}

function Terms() {
  return (
    <>
      <h2>Terms of Service</h2>
      <p className="lg-eff">Effective {EFFECTIVE}</p>
      <p>By using Roam, you agree to these Terms and to our Privacy Policy. If you don’t agree, please don’t use the app.</p>

      <h3>Who can use Roam</h3>
      <p>You must be at least 13 years old, and have a parent or guardian’s permission if you’re under 18.</p>

      <h3>Your account</h3>
      <p>Keep your login details secure and give accurate information. You’re responsible for activity that happens under your account.</p>

      <h3>Acceptable use</h3>
      <p>Don’t harass or impersonate others, misuse or scrape other people’s data, break the law, or interfere with the service. Play in the right spirit — don’t fake runs to game leaderboards.</p>

      <h3 className="lg-flag">Health, fitness & safety</h3>
      <ul>
        <li>Roam is <b>not a medical or professional fitness service</b> and does not provide medical advice. Talk to a doctor before starting any exercise program.</li>
        <li>Physical activity carries a risk of injury. <b>You take part at your own risk.</b></li>
        <li>You are responsible for your own safety: stay aware of your surroundings, obey all traffic and local laws, and don’t go anywhere unsafe. Suggested spots and routes are generated automatically and are <b>not checked for safety</b> — use your own judgment.</li>
        <li>To the fullest extent allowed by law, we are not liable for any injury, loss, or damage arising from your use of Roam.</li>
      </ul>

      <h3>Your content</h3>
      <p>Your runs, name, and photos are yours. You give us permission to store and display them so the app and its features work — including contributing your runs to the community map in anonymized form.</p>

      <h3>Third-party services</h3>
      <p>Features such as maps and Strava are provided by other companies and are subject to their own terms.</p>

      <h3>Service provided “as is”</h3>
      <p>Roam is an early, independent project provided “as is,” without warranties. It may have bugs, downtime, or change over time.</p>

      <h3>Limitation of liability</h3>
      <p>To the fullest extent allowed by law, our liability is limited, and we are not responsible for indirect or consequential damages.</p>

      <h3>Ending use</h3>
      <p>You can stop using Roam anytime. We may suspend accounts that break these Terms.</p>

      <h3>Changes & contact</h3>
      <p>We may update these Terms. These Terms are governed by the laws of the State of New Hampshire, USA. Questions? Email {CONTACT}.</p>
    </>
  );
}

function Safety() {
  return (
    <>
      <h2>Run smart 🏃</h2>
      <p className="lg-eff">A quick safety note</p>
      <p>Roam is built for fun — but your safety comes first.</p>
      <ul>
        <li><b>Not medical advice.</b> Roam isn’t a doctor or a fitness coach. Check with a physician before starting to exercise.</li>
        <li><b>Stay aware.</b> Keep your eyes up, watch for traffic, and obey all road and local laws.</li>
        <li><b>Pick safe routes.</b> Spots and routes Roam suggests are auto-generated and not vetted for safety. Don’t run anywhere you wouldn’t normally go, especially alone or after dark.</li>
        <li><b>Your call.</b> You run at your own risk. If something feels off, stop.</li>
      </ul>
      <p className="lg-eff">Full details are in our Terms of Service.</p>
    </>
  );
}

export default function Legal({ doc = 'privacy', onClose }) {
  const [tab, setTab] = useState(doc);
  return (
    <div className="legal">
      <div className="legal-bar">
        <button className="legal-back" onClick={onClose} aria-label="Close">‹ Back</button>
        <div className="legal-tabs">
          {TABS.map(t => (
            <button key={t.id} className={tab === t.id ? 'on' : ''} onClick={() => setTab(t.id)}>{t.label}</button>
          ))}
        </div>
      </div>
      <div className="legal-body">
        {tab === 'privacy' && <Privacy />}
        {tab === 'terms' && <Terms />}
        {tab === 'safety' && <Safety />}
        <div className="legal-foot">Roam · an independent project. This is a plain-language starting point, not formal legal advice.</div>
      </div>
    </div>
  );
}
