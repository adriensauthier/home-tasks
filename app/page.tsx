"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type Person = {
  id: string;
  name: string;
  created_at: string;
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
  passwordEnabled: boolean;
  authenticated: boolean;
};

const frequencyLabels: Record<Frequency, string> = {
  one_time: "Une fois",
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
  const [password, setPassword] = useState("");
  const [people, setPeople] = useState<Person[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [personName, setPersonName] = useState("");
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDescription, setTaskDescription] = useState("");
  const [taskAssignedTo, setTaskAssignedTo] = useState("");
  const [taskFrequency, setTaskFrequency] = useState<Frequency>("weekly");
  const [taskDueDate, setTaskDueDate] = useState("");
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

  const stats = useMemo(() => {
    const todoTasks = tasks.filter((task) => !task.done);
    const overdueTasks = tasks.filter(isOverdue);
    const completedTasks = tasks.filter((task) => task.done);

    return {
      total: tasks.length,
      todo: todoTasks.length,
      overdue: overdueTasks.length,
      completed: completedTasks.length
    };
  }, [tasks]);

  const tasksByPerson = useMemo(() => {
    return people.map((person) => ({
      person,
      tasks: tasks.filter((task) => task.assigned_to === person.id && !task.done)
    }));
  }, [people, tasks]);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");

    try {
      await requestJson("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ password })
      });
      await boot();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Mot de passe incorrect.");
    } finally {
      setSaving(false);
    }
  }

  async function handleLogout() {
    await requestJson("/api/auth/logout", { method: "POST" });
    setAuthStatus({ passwordEnabled: true, authenticated: false });
    setPeople([]);
    setTasks([]);
    setPassword("");
  }

  async function handleAddPerson(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");

    try {
      await requestJson("/api/people", {
        method: "POST",
        body: JSON.stringify({ name: personName })
      });
      setPersonName("");
      await loadData();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Impossible d'ajouter la personne.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeletePerson(personId: string) {
    setSaving(true);
    setError("");

    try {
      await requestJson(`/api/people/${personId}`, { method: "DELETE" });
      await loadData();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Impossible de supprimer la personne.");
    } finally {
      setSaving(false);
    }
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
          assigned_to: taskAssignedTo,
          frequency: taskFrequency,
          due_date: taskDueDate
        })
      });

      setTaskTitle("");
      setTaskDescription("");
      setTaskAssignedTo("");
      setTaskFrequency("weekly");
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
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Impossible de modifier la tâche.");
    } finally {
      setSaving(false);
    }
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

  if (authStatus?.passwordEnabled && !authStatus.authenticated) {
    return (
      <main className="shell centered">
        <section className="login-card">
          <p className="eyebrow">HomeTasks</p>
          <h1>Connexion à la maison</h1>
          <p>Entre le mot de passe partagé pour voir et modifier les tâches ménagères.</p>

          <form onSubmit={handleLogin} className="stack">
            <label>
              Mot de passe
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Mot de passe"
                autoFocus
              />
            </label>
            <button type="submit" disabled={saving}>
              {saving ? "Connexion..." : "Se connecter"}
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
          <h1>Suivi des tâches ménagères</h1>
          <p>
            Ajoute les personnes de la maison, crée les tâches, attribue-les et suis ce qui est fait ou en retard.
          </p>
        </div>

        {authStatus?.passwordEnabled && (
          <button className="secondary" onClick={handleLogout} type="button">
            Se déconnecter
          </button>
        )}
      </header>

      {error && <p className="error banner">{error}</p>}

      <section className="stats-grid">
        <article>
          <span>Total</span>
          <strong>{stats.total}</strong>
        </article>
        <article>
          <span>À faire</span>
          <strong>{stats.todo}</strong>
        </article>
        <article>
          <span>En retard</span>
          <strong>{stats.overdue}</strong>
        </article>
        <article>
          <span>Terminées</span>
          <strong>{stats.completed}</strong>
        </article>
      </section>

      <section className="grid two-columns">
        <article className="panel">
          <h2>Personnes</h2>
          <form onSubmit={handleAddPerson} className="inline-form">
            <input
              value={personName}
              onChange={(event) => setPersonName(event.target.value)}
              placeholder="Exemple : Léa"
            />
            <button disabled={saving || !personName.trim()} type="submit">
              Ajouter
            </button>
          </form>

          <div className="people-list">
            {people.length === 0 && <p className="muted">Ajoute d'abord les personnes de la maison.</p>}
            {people.map((person) => (
              <div className="person-row" key={person.id}>
                <span>{person.name}</span>
                <button className="ghost" onClick={() => handleDeletePerson(person.id)} type="button">
                  Supprimer
                </button>
              </div>
            ))}
          </div>
        </article>

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

            <div className="form-grid">
              <label>
                Attribuée à
                <select value={taskAssignedTo} onChange={(event) => setTaskAssignedTo(event.target.value)}>
                  <option value="">Personne</option>
                  {people.map((person) => (
                    <option value={person.id} key={person.id}>
                      {person.name}
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
            </div>

            <label>
              Date limite
              <input type="date" value={taskDueDate} onChange={(event) => setTaskDueDate(event.target.value)} />
            </label>

            <button disabled={saving || !taskTitle.trim()} type="submit">
              Créer la tâche
            </button>
          </form>
        </article>
      </section>

      <section className="panel">
        <h2>Répartition par personne</h2>
        <div className="assignment-grid">
          {tasksByPerson.map(({ person, tasks: assignedTasks }) => (
            <article className="assignment-card" key={person.id}>
              <strong>{person.name}</strong>
              <span>{assignedTasks.length} tâche{assignedTasks.length > 1 ? "s" : ""} à faire</span>
            </article>
          ))}
          {people.length === 0 && <p className="muted">La répartition apparaîtra ici.</p>}
        </div>
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
          {tasks.map((task) => (
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
                    <span>{task.person?.name ?? "Non attribuée"}</span>
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
                    <option value="">Personne</option>
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
    </main>
  );
}
