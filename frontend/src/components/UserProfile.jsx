export default function UserProfile() {
  const username = localStorage.getItem('auth_username') || 'Guest';
  const role     = localStorage.getItem('auth_role')     || 'citizen';

  const handleLogout = () => {
    localStorage.removeItem('auth_username');
    localStorage.removeItem('auth_role');
    window.location.href = '/';
  };

  return (
    <div className="user-profile-widget">
      <div className="user-avatar">
        {username.charAt(0).toUpperCase()}
      </div>
      <div className="user-info">
        <span className="user-name">{username}</span>
        <span className="user-role">{role}</span>
      </div>
      <button className="user-signout-btn" onClick={handleLogout}>Sign Out</button>
    </div>
  );
}
