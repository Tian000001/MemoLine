import React from 'react';
import { Route, Routes } from 'react-router-dom';

import Layout from './components/Layout';
import TimelinePage from './pages/TimelinePage/TimelinePage';
import EventFormPage from './pages/EventFormPage/EventFormPage';
import AnalysisPage from './pages/AnalysisPage/AnalysisPage';
import NotFound from './pages/NotFound/NotFound';

const RoutesComponent = () => {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<TimelinePage />} />
        <Route path="new" element={<EventFormPage />} />
        <Route path="edit/:id" element={<EventFormPage />} />
        <Route path="analysis" element={<AnalysisPage />} />
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

export default RoutesComponent;
