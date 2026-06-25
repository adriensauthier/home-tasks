"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type Person = {
  id: string;
  name: string;
  created_at: string;
};

type User = {
  id: string;
  username: string;
  name: string;
  personId: string;
};

type Frequency = "one_time" | "daily" | "weekly" | "monthly";

type Task = {
  id: string;
  title: string;
  description: string | null;
  assigned_to: string | null;
  frequency: Frequency;
  due_date: string | null;
  done: boolean;
  last_completed_at: string | null;
  created_at: string;
  person: Person | null;
};

type AuthStatus = {
  authenticated: boolean;
  user: User | null;
};

type TaskEditDraft = {
  title: string;
  description: string;
  assigned_to: string;
  frequency: Frequency;
  due_date: string;
};

const frequencyLabels: Record<Frequency, string> = {
  one_time: "Pas de récurrence",
  daily: "Tous les jours",
  weekly: "Chaque semaine",
  monthly: "Chaque mois"
};

function isOverdue(task: Task) {
  if (task.done || !task.due_date) {
    return false;
  }

  return task.due_date < new Date().toISOString().slice(0, 10);
}

function toIsoDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getWeekStart(date: Date) {
  const start = new Date(date);
  const weekday = (start.getDay() + 6) % 7;
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - weekday);
  return start;
}

function addDays(date: Date, days: number) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
}

function parseIsoDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function getTaskPoints(task: Task) {
  const completionDateIso = task.last_completed_at?.slice(0, 10);

  if (!completionDateIso) {
    return 0;
  }

  if (!task.due_date) {
    return 6;
  }

  const completedAt = parseIsoDate(completionDateIso).getTime();
  const dueAt = parseIsoDate(task.due_date).getTime();
  const dayDelta = Math.round((dueAt - completedAt) / (1000 * 60 * 60 * 24));
  const basePoints = 12 + dayDelta * 2;

  return Math.max(1, Math.min(30, basePoints));
}

async function requestJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers ?? {})
    }
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.error || "Une erreur est survenue.");
  }

  return payload as T;
}

export default function HomePage() {
  const [authStatus, setAuthStatus] = useState<AuthStatus | null>(null);
  const [username, setUsername] = useState("adrien");
  const [password, setPassword] = useState("");
  const [people, setPeople] = useState<Person[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDescription, setTaskDescription] = useState("");
  const [taskAssignedTo, setTaskAssignedTo] = useState("");
  const [taskFrequency, setTaskFrequency] = useState<Frequency>("one_time");
  const [taskDueDate, setTaskDueDate] = useState("");
  const [activeTab, setActiveTab] = useState<"new" | "overview" | "personal" | "ranking">("overview");
  const [calendarWeekStart, setCalendarWeekStart] = useState(() => getWeekStart(new Date()));
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [taskEditDraft, setTaskEditDraft] = useState<TaskEditDraft | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function loadData() {
    setError("");
    const [peoplePayload, tasksPayload] = await Promise.all([
      requestJson<{ people: Person[] }>("/api/people"),
      requestJson<{ tasks: Task[] }>("/api/tasks")
    ]);

    setPeople(peoplePayload.people);
    setTasks(tasksPayload.tasks);
  }

  async function boot() {
    try {
      setLoading(true);
      const status = await requestJson<AuthStatus>("/api/auth/status");
      setAuthStatus(status);

      if (status.authenticated) {
        await loadData();
      }
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Erreur inconnue.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void boot();
  }, []);

  useEffect(() => {
    if (authStatus?.user?.personId && !taskAssignedTo) {
      setTaskAssignedTo(authStatus.user.personId);
    }
  }, [authStatus?.user?.personId, taskAssignedTo]);

  const statsByPerson = useMemo(() => {
    return people.map((person) => {
      const personTasks = tasks.filter((task) => task.assigned_to === person.id);
      const todo = personTasks.filter((task) => !task.done).length;
      const overdue = personTasks.filter(isOverdue).length;
      const completed = personTasks.filter((task) => task.done).length;

      return {
        person,
        total: personTasks.length,
        todo,
        overdue,
        completed
      };
    });
  }, [people, tasks]);

  const currentPersonTasks = useMemo(() => {
    if (!authStatus?.user?.personId) {
      return [];
    }

    return tasks.filter((task) => task.assigned_to === authStatus.user?.personId);
  }, [authStatus?.user?.personId, tasks]);

  const currentPersonStats = useMemo(() => {
    return {
      total: currentPersonTasks.length,
      todo: currentPersonTasks.filter((task) => !task.done).length,
      overdue: currentPersonTasks.filter(isOverdue).length,
      completed: currentPersonTasks.filter((task) => task.done).length
    };
  }, [currentPersonTasks]);

  const ranking = useMemo(() => {
    const rankingMap = new Map<string, { person: Person; points: number; completed: number }>();

    for (const person of people) {
      rankingMap.set(person.id, {
        person,
        points: 0,
        completed: 0
      });
    }

    for (const task of tasks) {
      if (!task.done || !task.assigned_to) {
        continue;
      }

      const target = rankingMap.get(task.assigned_to);
      if (!target) {
        continue;
      }

      target.points += getTaskPoints(task);
      target.completed += 1;
    }

    return Array.from(rankingMap.values()).sort((left, right) => {
      if (left.points !== right.points) {
        return right.points - left.points;
      }

      return right.completed - left.completed;
    });
  }, [people, tasks]);

  const calendarDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, index) => {
      const date = addDays(calendarWeekStart, index);
      const isoDate = toIsoDate(date);
      const dayTasks = tasks.filter((task) => task.due_date === isoDate);

      return {
        isoDate,
        date,
        isToday: isoDate === toIsoDate(new Date()),
        tasks: dayTasks
      };
    });
  }, [calendarWeekStart, tasks]);

  const calendarWeekLabel = useMemo(() => {
    const weekEnd = addDays(calendarWeekStart, 6);
    const startLabel = calendarWeekStart.toLocaleDateString("fr-CH", {
      day: "numeric",
      month: "long"
    });
    const endLabel = weekEnd.toLocaleDateString("fr-CH", {
      day: "numeric",
      month: "long",
      year: "numeric"
    });

    return `${startLabel} - ${endLabel}`;
  }, [calendarWeekStart]);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");

    try {
      await requestJson("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ username, password })
      });
      await boot();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Impossible de se connecter.");
    } finally {
      setSaving(false);
    }
  }

  async function handleLogout() {
    await requestJson("/api/auth/logout", { method: "POST" });
    setAuthStatus({ authenticated: false, user: null });
    setTasks([]);
    setPassword("");
  }

  async function handleAddTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");

    try {
      await requestJson("/api/tasks", {
        method: "POST",
        body: JSON.stringify({
          title: taskTitle,
          description: taskDescription,
          assigned_to: taskAssignedTo || authStatus?.user?.personId,
          frequency: taskFrequency,
          due_date: taskDueDate
        })
      });

      setTaskTitle("");
      setTaskDescription("");
      setTaskAssignedTo(authStatus?.user?.personId ?? "");
      setTaskFrequency("one_time");
      setTaskDueDate("");
      await loadData();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Impossible d'ajouter la tâche.");
    } finally {
      setSaving(false);
    }
  }

  async function updateTask(taskId: string, body: Record<string, unknown>) {
    setSaving(true);
    setError("");

    try {
      await requestJson(`/api/tasks/${taskId}`, {
        method: "PATCH",
        body: JSON.stringify(body)
      });
      await loadData();
      return true;
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Impossible de modifier la tâche.");
    } finally {
      setSaving(false);
    }
  }

  function startEditingTask(task: Task) {
    setEditingTaskId(task.id);
    setTaskEditDraft({
      title: task.title,
      description: task.description ?? "",
      assigned_to: task.assigned_to ?? "",
      frequency: task.frequency,
      due_date: task.due_date ?? ""
    });
  }

  function updateTaskEditDraft<K extends keyof TaskEditDraft>(field: K, value: TaskEditDraft[K]) {
    setTaskEditDraft((currentDraft) => {
      if (!currentDraft) {
        return currentDraft;
      }

      return {
        ...currentDraft,
        [field]: value
      };
    });
  }

  async function saveEditedTask(taskId: string) {
    if (!taskEditDraft) {
      return;
    }

    const updated = await updateTask(taskId, {
      title: taskEditDraft.title,
      description: taskEditDraft.description,
      assigned_to: taskEditDraft.assigned_to,
      frequency: taskEditDraft.frequency,
      due_date: taskEditDraft.due_date
    });

    if (updated) {
      setEditingTaskId(null);
      setTaskEditDraft(null);
    }
  }

  function cancelEditingTask() {
    setEditingTaskId(null);
    setTaskEditDraft(null);
  }

  async function deleteTask(taskId: string) {
    setSaving(true);
    setError("");

    try {
      await requestJson(`/api/tasks/${taskId}`, { method: "DELETE" });
      await loadData();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Impossible de supprimer la tâche.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="shell centered">
        <div className="loader">Chargement de HomeTasks...</div>
      </main>
    );
  }

  if (!authStatus?.authenticated) {
    return (
      <main className="shell centered">
        <section className="login-card">
          <p className="eyebrow">HomeTasks</p>
          <h1>Connexion</h1>
          <p>Choisis ton compte et définis ton mot de passe lors de la première connexion.</p>

          <form onSubmit={handleLogin} className="stack">
            <label>
              Compte
              <select value={username} onChange={(event) => setUsername(event.target.value)}>
                <option value="stephane">Stéphane</option>
                <option value="claudine">Claudine</option>
                <option value="adrien">Adrien</option>
                <option value="lea">Léa</option>
              </select>
            </label>

            <label>
              Mot de passe
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Définis ton mot de passe"
                autoFocus
              />
            </label>
            <button type="submit" disabled={saving}>
              {saving ? "Connexion..." : "Entrer"}
            </button>
          </form>

          {error && <p className="error">{error}</p>}
        </section>
      </main>
    );
  }

  return (
    <main className="shell">
      <header className="hero">
        <div>
          <p className="eyebrow">HomeTasks</p>
          <h1>Tâches de la maison</h1>
          <p>Bienvenue {authStatus.user?.name ?? "à la maison"}. Organisons la semaine ensemble.</p>
        </div>

        <div className="hero-actions">
          {authStatus.user && <span className="current-user-pill">{authStatus.user.name}</span>}
          <button className="secondary" onClick={handleLogout} type="button">
            Se déconnecter
          </button>
        </div>
      </header>

      {error && <p className="error banner">{error}</p>}

      <section className="tabs-row">
        <button
          className={`tab-button ${activeTab === "new" ? "active" : ""}`}
          onClick={() => setActiveTab("new")}
          type="button"
        >
          Nouvelle tâche
        </button>
        <button
          className={`tab-button ${activeTab === "overview" ? "active" : ""}`}
          onClick={() => setActiveTab("overview")}
          type="button"
        >
          Vue d'ensemble
        </button>
        <button
          className={`tab-button ${activeTab === "personal" ? "active" : ""}`}
          onClick={() => setActiveTab("personal")}
          type="button"
        >
          Vue personnelle
        </button>
        <button
          className={`tab-button ${activeTab === "ranking" ? "active" : ""}`}
          onClick={() => setActiveTab("ranking")}
          type="button"
        >
          Classement
        </button>
      </section>

      <nav className="mobile-bottom-nav" aria-label="Navigation principale">
        <button
          className={`mobile-nav-button ${activeTab === "new" ? "active" : ""}`}
          aria-current={activeTab === "new" ? "page" : undefined}
          onClick={() => setActiveTab("new")}
          type="button"
        >
          Créer
        </button>
        <button
          className={`mobile-nav-button ${activeTab === "overview" ? "active" : ""}`}
          aria-current={activeTab === "overview" ? "page" : undefined}
          onClick={() => setActiveTab("overview")}
          type="button"
        >
          Vue
        </button>
        <button
          className={`mobile-nav-button ${activeTab === "personal" ? "active" : ""}`}
          aria-current={activeTab === "personal" ? "page" : undefined}
          onClick={() => setActiveTab("personal")}
          type="button"
        >
          Mes tâches
        </button>
        <button
          className={`mobile-nav-button ${activeTab === "ranking" ? "active" : ""}`}
          aria-current={activeTab === "ranking" ? "page" : undefined}
          onClick={() => setActiveTab("ranking")}
          type="button"
        >
          Scores
        </button>
      </nav>

      {activeTab === "new" && (
        <section className="grid two-columns">
          <article className="panel">
            <h2>Nouvelle tâche</h2>
            <form onSubmit={handleAddTask} className="stack">
              <label>
                Tâche
                <input
                  value={taskTitle}
                  onChange={(event) => setTaskTitle(event.target.value)}
                  placeholder="Exemple : Sortir les poubelles"
                />
              </label>

              <label>
                Description facultative
                <textarea
                  value={taskDescription}
                  onChange={(event) => setTaskDescription(event.target.value)}
                  placeholder="Détails, consignes, endroit, etc."
                />
              </label>

              <label>
                Attribuée à
                <select value={taskAssignedTo} onChange={(event) => setTaskAssignedTo(event.target.value)}>
                  {people.map((person) => (
                    <option value={person.id} key={person.id}>
                      {person.name}
                      {person.id === authStatus.user?.personId ? " (moi)" : ""}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Fréquence
                <select value={taskFrequency} onChange={(event) => setTaskFrequency(event.target.value as Frequency)}>
                  {Object.entries(frequencyLabels).map(([value, label]) => (
                    <option value={value} key={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Date limite
                <input
                  required
                  type="date"
                  value={taskDueDate}
                  onChange={(event) => setTaskDueDate(event.target.value)}
                />
              </label>

              <button disabled={saving || !taskTitle.trim() || !taskDueDate} type="submit">
                Créer la tâche
              </button>
            </form>
          </article>
        </section>
      )}

      {activeTab === "overview" && (
        <>
          <section className="people-stats-grid">
            {statsByPerson.map((entry) => (
              <article className="person-stat-card" key={entry.person.id}>
                <div className="person-stat-head">
                  <strong>{entry.person.name}</strong>
                  <span>{entry.total} tâche{entry.total > 1 ? "s" : ""}</span>
                </div>
                <div className="person-stat-values">
                  <span>À faire: {entry.todo}</span>
                  <span>En retard: {entry.overdue}</span>
                  <span>Terminées: {entry.completed}</span>
                </div>
              </article>
            ))}
          </section>

          <section className="grid two-columns">
            <article className="panel">
              <div className="section-header">
                <h2>Calendrier des tâches</h2>
                <div className="calendar-nav">
                  <button
                    className="secondary"
                    onClick={() => setCalendarWeekStart((currentWeekStart) => addDays(currentWeekStart, -7))}
                    type="button"
                  >
                    Semaine précédente
                  </button>
                  <strong className="calendar-label">{calendarWeekLabel}</strong>
                  <button
                    className="secondary"
                    onClick={() => setCalendarWeekStart((currentWeekStart) => addDays(currentWeekStart, 7))}
                    type="button"
                  >
                    Semaine suivante
                  </button>
                </div>
              </div>

              <div className="calendar-grid week-head">
                {["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"].map((label) => (
                  <span key={label}>{label}</span>
                ))}
              </div>

              <div className="calendar-grid days">
                {calendarDays.map((day) => (
                  <article className={`calendar-day ${day.isToday ? "today" : ""}`} key={day.isoDate}>
                    <header>
                      <span>{day.date.getDate()}</span>
                      <small>{day.date.toLocaleDateString("fr-CH", { month: "short" })}</small>
                    </header>
                    <div className="calendar-day-tasks">
                      {day.tasks.slice(0, 3).map((task) => (
                        <div className={`calendar-chip ${task.done ? "done" : ""}`} key={task.id}>
                          <span>{task.person?.name ?? "Non attribuée"}</span>
                          <small>{task.title}</small>
                        </div>
                      ))}
                      {day.tasks.length > 3 && <span className="more-count">+{day.tasks.length - 3}</span>}
                    </div>
                  </article>
                ))}
              </div>
            </article>
          </section>

          <section className="panel">
            <div className="section-header">
              <h2>Toutes les tâches</h2>
              <button className="secondary" onClick={loadData} type="button">
                Actualiser
              </button>
            </div>

            <div className="task-list">
              {tasks.length === 0 && <p className="muted">Aucune tâche pour le moment.</p>}
              {tasks.map((task) => {
                const currentDraft = editingTaskId === task.id ? taskEditDraft : null;

                return (
                  <article className={`task-card ${task.done ? "done" : ""} ${isOverdue(task) ? "overdue" : ""}`} key={task.id}>
                    {currentDraft ? (
                      <form
                        className="edit-task-form"
                        onSubmit={(event) => {
                          event.preventDefault();
                          void saveEditedTask(task.id);
                        }}
                      >
                        <div className="form-grid">
                          <label>
                            Tâche
                            <input
                              value={currentDraft.title}
                              onChange={(event) => updateTaskEditDraft("title", event.target.value)}
                            />
                          </label>

                          <label>
                            Attribuée à
                            <select
                              value={currentDraft.assigned_to}
                              onChange={(event) => updateTaskEditDraft("assigned_to", event.target.value)}
                            >
                              <option value="">Non attribuée</option>
                              {people.map((person) => (
                                <option value={person.id} key={person.id}>
                                  {person.name}
                                </option>
                              ))}
                            </select>
                          </label>

                          <label>
                            Fréquence
                            <select
                              value={currentDraft.frequency}
                              onChange={(event) => updateTaskEditDraft("frequency", event.target.value as Frequency)}
                            >
                              {Object.entries(frequencyLabels).map(([value, label]) => (
                                <option value={value} key={value}>
                                  {label}
                                </option>
                              ))}
                            </select>
                          </label>

                          <label>
                            Date limite
                            <input
                              type="date"
                              value={currentDraft.due_date}
                              onChange={(event) => updateTaskEditDraft("due_date", event.target.value)}
                            />
                          </label>
                        </div>

                        <label>
                          Description facultative
                          <textarea
                            value={currentDraft.description}
                            onChange={(event) => updateTaskEditDraft("description", event.target.value)}
                          />
                        </label>

                        <div className="edit-task-actions">
                          <button disabled={saving || !currentDraft.title.trim()} type="submit">
                            Enregistrer
                          </button>
                          <button className="secondary" onClick={cancelEditingTask} type="button">
                            Annuler
                          </button>
                        </div>
                      </form>
                    ) : (
                      <div className="task-main">
                        <div>
                          <div className="task-title-row">
                            <h3>{task.title}</h3>
                            {task.done && <span className="pill done-pill">Terminée</span>}
                            {isOverdue(task) && <span className="pill overdue-pill">En retard</span>}
                          </div>
                          {task.description && <p>{task.description}</p>}
                          <div className="task-meta">
                            <span>{task.person?.name ?? "Non attribuée"}</span>
                            <span>{frequencyLabels[task.frequency]}</span>
                            <span>{task.due_date ? `Pour le ${new Date(`${task.due_date}T00:00:00`).toLocaleDateString("fr-CH")}` : "Pas de date"}</span>
                          </div>
                        </div>

                        <div className="task-actions">
                          <button className="secondary" onClick={() => startEditingTask(task)} type="button">
                            Modifier
                          </button>

                          {!task.done ? (
                            <button onClick={() => updateTask(task.id, { action: "complete" })} type="button">
                              Marquer faite
                            </button>
                          ) : (
                            <button className="secondary" onClick={() => updateTask(task.id, { action: "reopen" })} type="button">
                              Rouvrir
                            </button>
                          )}

                          <button className="ghost danger" onClick={() => deleteTask(task.id)} type="button">
                            Supprimer
                          </button>
                        </div>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          </section>
        </>
      )}

      {activeTab === "personal" && (
        <>
          <section className="people-stats-grid">
            <article className="person-stat-card current-person-card">
              <div className="person-stat-head">
                <strong>{authStatus.user?.name ?? "Moi"}</strong>
                <span>{currentPersonStats.total} tâche{currentPersonStats.total > 1 ? "s" : ""}</span>
              </div>
              <div className="person-stat-values">
                <span>À faire: {currentPersonStats.todo}</span>
                <span>En retard: {currentPersonStats.overdue}</span>
                <span>Terminées: {currentPersonStats.completed}</span>
              </div>
            </article>
          </section>

          <section className="panel">
            <div className="section-header">
              <h2>Mes tâches</h2>
              <button className="secondary" onClick={loadData} type="button">
                Actualiser
              </button>
            </div>

            <div className="task-list">
              {currentPersonTasks.length === 0 && <p className="muted">Aucune tâche pour le moment.</p>}
              {currentPersonTasks.map((task) => (
                <article className={`task-card ${task.done ? "done" : ""} ${isOverdue(task) ? "overdue" : ""}`} key={task.id}>
                  <div className="task-main">
                    <div>
                      <div className="task-title-row">
                        <h3>{task.title}</h3>
                        {task.done && <span className="pill done-pill">Terminée</span>}
                        {isOverdue(task) && <span className="pill overdue-pill">En retard</span>}
                      </div>
                      {task.description && <p>{task.description}</p>}
                      <div className="task-meta">
                        <span>{frequencyLabels[task.frequency]}</span>
                        <span>{task.due_date ? `Pour le ${new Date(`${task.due_date}T00:00:00`).toLocaleDateString("fr-CH")}` : "Pas de date"}</span>
                      </div>
                    </div>

                    <div className="task-actions">
                      <select
                        value={task.assigned_to ?? ""}
                        onChange={(event) => updateTask(task.id, { assigned_to: event.target.value })}
                        aria-label="Changer la personne assignée"
                      >
                        <option value="">Non attribuée</option>
                        {people.map((person) => (
                          <option value={person.id} key={person.id}>
                            {person.name}
                          </option>
                        ))}
                      </select>

                      {!task.done ? (
                        <button onClick={() => updateTask(task.id, { action: "complete" })} type="button">
                          Marquer faite
                        </button>
                      ) : (
                        <button className="secondary" onClick={() => updateTask(task.id, { action: "reopen" })} type="button">
                          Rouvrir
                        </button>
                      )}

                      <button className="ghost danger" onClick={() => deleteTask(task.id)} type="button">
                        Supprimer
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </>
      )}

      {activeTab === "ranking" && (
        <section className="panel ranking-panel">
          <div className="section-header">
            <h2>Classement des personnes</h2>
            <span className="muted">Plus une tâche est terminée avant sa date, plus elle rapporte de points.</span>
          </div>

          <div className="ranking-list">
            {ranking.map((entry, index) => (
              <article className="ranking-row" key={entry.person.id}>
                <div className="ranking-position">#{index + 1}</div>
                <div className="ranking-person">
                  <strong>{entry.person.name}</strong>
                  <span>{entry.completed} tâche{entry.completed > 1 ? "s" : ""} terminée{entry.completed > 1 ? "s" : ""}</span>
                </div>
                <div className="ranking-points">{entry.points} pts</div>
              </article>
            ))}

            {ranking.length === 0 && <p className="muted">Le classement apparaîtra après les premières tâches terminées.</p>}
          </div>
        </section>
      )}
    </main>
  );
}
