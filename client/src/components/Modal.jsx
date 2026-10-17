import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';

export default function Modal({ title, onClose, children, footer, width = 460 }) {
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Separate body content from lower actions bar so the scrollbar terminates cleanly above the toolbar
  let bodyContent = children;
  let footContent = footer || null;

  if (!footContent && React.isValidElement(children)) {
    // Case 1: Children is a <form> containing a .modal-actions child
    if (children.type === 'form') {
      const formChildren = React.Children.toArray(children.props.children);
      const actionsIndex = formChildren.findIndex(
        (c) => React.isValidElement(c) && (c.props.className || '').includes('modal-actions')
      );

      if (actionsIndex !== -1) {
        const actionsElem = formChildren[actionsIndex];
        const restChildren = formChildren.filter((_, idx) => idx !== actionsIndex);
        const formId = children.props.id || 'modal-dialog-form';

        bodyContent = React.cloneElement(children, {
          id: formId,
          className: children.props.className ? `${children.props.className} modal-scroll-body` : 'modal-scroll-body',
          children: restChildren,
        });

        const updatedButtons = React.Children.map(actionsElem.props.children, (btn) => {
          if (React.isValidElement(btn) && btn.props.type === 'submit' && !btn.props.form) {
            return React.cloneElement(btn, { form: formId });
          }
          return btn;
        });

        footContent = (
          <div className="modal-foot">
            {updatedButtons}
          </div>
        );
      }
    } else {
      // Case 2: Children is a <div> (or other container) containing a .modal-actions child
      const topChildren = React.Children.toArray(children.props?.children || []);
      const actionsIndex = topChildren.findIndex(
        (c) => React.isValidElement(c) && (c.props.className || '').includes('modal-actions')
      );

      if (actionsIndex !== -1) {
        const actionsElem = topChildren[actionsIndex];
        const restChildren = topChildren.filter((_, idx) => idx !== actionsIndex);

        bodyContent = React.cloneElement(children, {
          children: restChildren,
        });

        footContent = (
          <div className="modal-foot">
            {actionsElem.props.children}
          </div>
        );
      }
    }
  }

  return createPortal(
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div
        className="modal-card"
        style={{ maxWidth: width }}
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="modal-head">
          <h3>{title}</h3>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        <div className="modal-body">{bodyContent}</div>
        {footContent && (footContent.props?.className === 'modal-foot' ? footContent : <div className="modal-foot">{footContent}</div>)}
      </div>
    </div>,
    document.body
  );
}
