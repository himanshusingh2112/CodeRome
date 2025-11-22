import React from 'react';
import Avatar from 'react-avatar';

function Client({ username, currentUser }) {
  // Check if this avatar belongs to the current user
  const isMe = username === currentUser;

  return (
    //to print the avatars of clients joined
    <div className="d-flex align-items-center mb-3">
      <Avatar name={username.toString()} size={50} round="14px" className="mr-3" />
      <span className="mx-2">
        {username.toString()} {isMe && <span style={{ color: '#0d6efd', fontWeight: 'bold' }}>(Me)</span>}
      </span>
    </div>
  );
}

export default Client;
