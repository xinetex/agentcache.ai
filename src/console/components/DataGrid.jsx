import React from 'react';

const DataGrid = ({ columns, data, onRowClick }) => {
    return (
        <div className="w-full overflow-x-auto">
            <table className="w-full text-left border-collapse">
                <thead>
                    <tr className="border-b border-[var(--hud-border)]">
                        {columns.map((col, idx) => (
                            <th
                                key={idx}
                                className="py-3 px-4 text-xs font-['Rajdhani'] font-bold text-[var(--hud-text-dim)] uppercase tracking-wider whitespace-nowrap bg-[rgba(0,0,0,0.2)]"
                            >
                                {col.header}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody className="font-mono text-sm">
                    {data.map((row, rowIdx) => (
                        <tr
                            key={row.id || rowIdx}
                            onClick={() => onRowClick && onRowClick(row)}
                            className={`
                border-b border-[rgba(255,255,255,0.05)] transition-colors duration-200
                ${onRowClick ? 'cursor-pointer hover:bg-[rgba(0,243,255,0.05)]' : ''}
                group
              `}
                        >
                            {columns.map((col, colIdx) => (
                                <td key={colIdx} className="py-3 px-4 text-white group-hover:text-[var(--hud-accent)] transition-colors">
                                    {col.render ? col.render(row) : row[col.accessor]}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default DataGrid;
