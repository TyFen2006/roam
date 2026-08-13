import { useState } from 'react';
import Friends from './Friends.jsx';
import Groups from './Groups.jsx';
import './Social.css';

export default function Social({ userId }) {
  const [seg, setSeg] = useState('friends');
  return (
    <div className="social">
      <div className="seg-toggle">
        <button className={seg === 'friends' ? 'on' : ''} onClick={() => setSeg('friends')}>Friends</button>
        <button className={seg === 'groups' ? 'on' : ''} onClick={() => setSeg('groups')}>Groups</button>
      </div>
      {seg === 'friends' ? <Friends userId={userId} /> : <Groups userId={userId} />}
    </div>
  );
}
