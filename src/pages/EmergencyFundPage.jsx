import React from 'react';
import EmergencyFundTracker from '../components/EmergencyFundTracker';
import BackButton from '../components/BackButton';

export default function EmergencyFundPage() {
    return (
        <div className="page-layout">
            <div className="page-header">
                <div className="container">
                    <div className="flex items-center gap-3 mb-4">
                        <BackButton />
                        <div>
                            <div className="section-title">Emergency Fund</div>
                            <h2 style={{ fontSize: 'clamp(1rem,2.5vw,1.35rem)' }}>🛡️ Dedicated Parking</h2>
                        </div>
                    </div>
                </div>
            </div>

            <div className="container" style={{ paddingTop: 32 }}>
                <EmergencyFundTracker />
            </div>
        </div>
    );
}
