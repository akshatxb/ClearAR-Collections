import { useCallback, useEffect, useState } from 'react';
import { X, KeyRound, UserX, UserCheck } from 'lucide-react';
import * as api from '../../api/endpoints';
import { apiErrorMessage } from '../../api/client';
import { useAuth } from '../../context/useAuth';
import { useToast } from '../../context/ToastContext';
import Modal from '../../components/Modal';
import { TempPasswordModal } from './PlatformAdmin';
import './PlatformAdmin.css';

export default function PlatformTeam() {
  const { user: currentAuthUser } = useAuth();
  const { toast } = useToast();
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Modals
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [resettingAdmin, setResettingAdmin] = useState(null);
  const [togglingAdmin, setTogglingAdmin] = useState(null);
  const [tempPasswordInfo, setTempPasswordInfo] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.listPlatformAdmins();
      setAdmins(data);
    } catch (err) {
      setError(apiErrorMessage(err, 'Failed to load platform administrators.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Platform Team</h1>
          <p className="page-subtitle">Manage internal vendor operators with platform-wide administrative privileges</p>
        </div>
      </div>

      <div className="panel">
        <div className="panel-title-row">
          <div className="panel-title-group">
            <span className="panel-title">Operators</span>
            <span className="badge badge-neutral">{admins.length} total</span>
          </div>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setShowInviteModal(true)}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            <span>Add platform admin</span>
          </button>
        </div>

        {error && <p className="error-text">{error}</p>}

        {loading ? (
          <p className="empty-state">Loading team…</p>
        ) : admins.length === 0 ? (
          <p className="empty-state">No platform administrators found.</p>
        ) : (
          <table className="mini-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Status</th>
                <th>Added</th>
                <th className="align-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {admins.map((admin) => {
                const isSelf = currentAuthUser?.userId === admin.id;
                return (
                  <tr key={admin.id}>
                    <td>
                      <strong>{admin.name || '—'}</strong>
                      {isSelf && <span className="current-user-tag">You</span>}
                    </td>
                    <td>{admin.email}</td>
                    <td>
                      {admin.active ? (
                        <span className="user-status-active">Active</span>
                      ) : (
                        <span className="user-status-inactive">Inactive</span>
                      )}
                    </td>
                    <td>{admin.createdAt ? new Date(admin.createdAt).toLocaleDateString() : '—'}</td>
                    <td className="align-right">
                      <div className="row-actions">
                        <button
                          type="button"
                          className="tbl-btn tbl-btn-secondary"
                          title="Generate a temporary password for this admin"
                          onClick={() => setResettingAdmin(admin)}
                        >
                          <KeyRound size={12} strokeWidth={2} />
                          <span>Reset password</span>
                        </button>
                        {admin.active ? (
                          <button
                            type="button"
                            className="tbl-btn tbl-btn-danger"
                            disabled={isSelf}
                            title={isSelf ? 'You cannot deactivate your own account' : 'Deactivate admin'}
                            onClick={() => setTogglingAdmin(admin)}
                          >
                            <UserX size={12} strokeWidth={2} />
                            <span>Deactivate</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="tbl-btn tbl-btn-success"
                            onClick={() => setTogglingAdmin(admin)}
                          >
                            <UserCheck size={12} strokeWidth={2} />
                            <span>Reactivate</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Invite Modal */}
      {showInviteModal && (
        <InvitePlatformAdminModal
          onClose={() => setShowInviteModal(false)}
          onCreated={(data) => {
            setShowInviteModal(false);
            setTempPasswordInfo({ email: data.email, tempPassword: data.tempPassword });
            toast.success(`Platform admin "${data.email}" added.`);
            load();
          }}
        />
      )}

      {/* Deactivate/Reactivate Modal */}
      {togglingAdmin && (
        <ToggleAdminStatusModal
          admin={togglingAdmin}
          onClose={() => setTogglingAdmin(null)}
          onToggled={(updated) => {
            const name = togglingAdmin.name || togglingAdmin.email;
            setTogglingAdmin(null);
            toast.success(`"${name}" is now ${updated.active ? 'active' : 'deactivated'}.`);
            load();
          }}
        />
      )}

      {/* Reset Password Modal */}
      {resettingAdmin && (
        <ResetAdminPasswordModal
          admin={resettingAdmin}
          onClose={() => setResettingAdmin(null)}
          onReset={(data) => {
            setResettingAdmin(null);
            setTempPasswordInfo({ email: data.email, tempPassword: data.tempPassword });
            toast.success(`Temporary password generated for ${data.email}.`);
            load();
          }}
        />
      )}

      {/* Temp Password Display Modal */}
      {tempPasswordInfo && (
        <TempPasswordModal
          info={tempPasswordInfo}
          onClose={() => setTempPasswordInfo(null)}
        />
      )}
    </div>
  );
}

function InvitePlatformAdminModal({ onClose, onCreated }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e) {
    e.preventDefault();
    if (!email.trim()) return;
    setBusy(true);
    setError('');
    try {
      const { data } = await api.createPlatformAdmin({ email: email.trim(), name: name.trim() });
      onCreated(data);
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not add platform administrator.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Add platform administrator" onClose={onClose}>
      <form onSubmit={submit}>
        <div className="field">
          <label htmlFor="admin-name">Full name</label>
          <input
            id="admin-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Alex Rivera"
            autoFocus
          />
        </div>
        <div className="field">
          <label htmlFor="admin-email">Email address</label>
          <input
            id="admin-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="e.g. alex.admin@vendor.com"
            required
          />
        </div>
        {error && <p className="error-text">{error}</p>}
        <div className="modal-actions">
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy || !email.trim()}>
            {busy ? 'Adding…' : 'Add administrator'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function ToggleAdminStatusModal({ admin, onClose, onToggled }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const nextActive = !admin.active;

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const { data } = await api.setPlatformAdminActive(admin.id, nextActive);
      onToggled(data);
    } catch (err) {
      setError(apiErrorMessage(err, `Could not ${nextActive ? 'reactivate' : 'deactivate'} administrator.`));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={`${nextActive ? 'Reactivate' : 'Deactivate'} administrator`} onClose={onClose}>
      <form onSubmit={submit}>
        <p className="modal-description">
          Are you sure you want to {nextActive ? 'reactivate' : 'deactivate'}{' '}
          <strong>{admin.name || admin.email}</strong> ({admin.email})?
          {!nextActive && ' They will be blocked from logging into the platform admin portal immediately.'}
        </p>
        {error && <p className="error-text">{error}</p>}
        <div className="modal-actions">
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button
            type="submit"
            className={`btn ${nextActive ? 'btn-primary' : 'btn-danger'}`}
            disabled={busy}
          >
            {busy ? 'Saving…' : nextActive ? 'Reactivate administrator' : 'Deactivate administrator'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function ResetAdminPasswordModal({ admin, onClose, onReset }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const { data } = await api.resetPlatformAdminPassword(admin.id);
      onReset(data);
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not reset password.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={`Reset password — ${admin.name || admin.email}`} onClose={onClose}>
      <form onSubmit={submit}>
        <p className="modal-description">
          Generate a new temporary password for <strong>{admin.email}</strong>? Their current password will be invalidated immediately.
        </p>
        {error && <p className="error-text">{error}</p>}
        <div className="modal-actions">
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? 'Generating…' : 'Generate temporary password'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
