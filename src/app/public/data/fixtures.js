export const UI_FIXTURES = Object.freeze({
  dashboard: {
    sessionsToday: 3,
    activePatients: 2,
    pendingFollowUps: 2,
    recentProtocols: 4,
    recentActivity: [
      { id: 'activity-1', title: 'Sessão concluída', detail: 'Ana Martins · Protocolo analgesia cervical', meta: '09:20' },
      { id: 'activity-2', title: 'Retorno programado', detail: 'Carlos Menezes · reavaliação clínica', meta: '11:40' },
      { id: 'activity-3', title: 'Protocolo revisado', detail: 'Tendinopatia de ombro · v4', meta: 'Ontem' }
    ]
  },
  patients: [
    {
      id: 'mock-patient-001',
      fullName: 'Ana Martins',
      status: 'active',
      phone: '(16) 99900-1001',
      email: 'ana.martins@example.test',
      notes: 'Acompanhamento de dor cervical.',
      birthDate: '1989-04-18',
      lastSession: '22/09/2026 · 09:20',
      nextSession: '29/09/2026 · 09:00',
      currentProtocol: 'Analgesia cervical · v3',
      alerts: [],
      pendingItems: ['Reavaliar escala de dor no próximo retorno'],
      clinicalIntake: {
        anamnesis: { complaint: 'Dor cervical recorrente', goal: 'Acompanhar dor e mobilidade', medications: '', precautions: '' },
        consent: { status: 'pending', updatedAt: null },
        safetyChecklist: { identityConfirmed: true, objectiveReviewed: true, precautionsReviewed: false, siteReviewed: false, equipmentReviewed: false, professionalConfirmed: false }
      },
      timeline: [
        { id: 'ana-t1', title: 'Sessão concluída', description: 'Aplicação registrada conforme planejamento.', meta: '22/09/2026' },
        { id: 'ana-t2', title: 'Protocolo atualizado', description: 'Analgesia cervical passou para v3.', meta: '15/09/2026' }
      ]
    },
    {
      id: 'mock-patient-002',
      fullName: 'Carlos Menezes',
      status: 'active',
      phone: '(16) 99900-1002',
      email: 'carlos.menezes@example.test',
      notes: 'Retorno pendente para reavaliação.',
      birthDate: '1978-11-02',
      lastSession: '18/09/2026 · 14:10',
      nextSession: '30/09/2026 · 15:30',
      currentProtocol: 'Tendinopatia de ombro · v4',
      alerts: ['Revisar uso informado de medicação fotossensibilizante antes da próxima aplicação.'],
      pendingItems: ['Confirmar atualização medicamentosa', 'Registrar escala funcional no retorno'],
      clinicalIntake: {
        anamnesis: { complaint: 'Dor e limitação funcional no ombro', goal: 'Reavaliar função e evolução relatada', medications: 'Uso informado requer revisão profissional', precautions: 'Revisar informação de possível fotossensibilização relatada' },
        consent: { status: 'pending', updatedAt: null },
        safetyChecklist: { identityConfirmed: true, objectiveReviewed: true, precautionsReviewed: false, siteReviewed: false, equipmentReviewed: false, professionalConfirmed: false }
      },
      timeline: [
        { id: 'carlos-t1', title: 'Alerta clínico registrado', description: 'Revisão medicamentosa necessária antes da sessão.', meta: '18/09/2026' },
        { id: 'carlos-t2', title: 'Sessão concluída', description: 'Sem intercorrência registrada.', meta: '18/09/2026' }
      ]
    },
    {
      id: 'mock-patient-003',
      fullName: 'Marina Rocha',
      status: 'inactive',
      phone: '(16) 99900-1003',
      email: 'marina.rocha@example.test',
      notes: 'Tratamento encerrado no ciclo atual.',
      birthDate: '1995-07-11',
      lastSession: '10/08/2026 · 10:30',
      nextSession: null,
      currentProtocol: 'Recuperação muscular · v2',
      alerts: [],
      pendingItems: [],
      clinicalIntake: {
        anamnesis: { complaint: 'Recuperação muscular', goal: 'Acompanhamento do ciclo encerrado', medications: '', precautions: '' },
        consent: { status: 'pending', updatedAt: null },
        safetyChecklist: { identityConfirmed: false, objectiveReviewed: false, precautionsReviewed: false, siteReviewed: false, equipmentReviewed: false, professionalConfirmed: false }
      },
      timeline: [
        { id: 'marina-t1', title: 'Ciclo concluído', description: 'Atendimento encerrado no ciclo atual.', meta: '10/08/2026' }
      ]
    }
  ]
});
