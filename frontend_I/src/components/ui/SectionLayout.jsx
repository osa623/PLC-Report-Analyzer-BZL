import React from 'react';

const SectionLayout = ({ title, description, actions, children }) => {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-semibold text-slate-900 tracking-heading leading-heading">{title}</h1>
          {description && (
            <p className="text-[13px] text-slate-500 mt-1.5 leading-rhythm tracking-refined">{description}</p>
          )}
        </div>
        {actions && <div className="flex items-center gap-3">{actions}</div>}
      </div>
      {children}
    </div>
  );
};

export default SectionLayout;
