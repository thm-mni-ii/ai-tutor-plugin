import axios from 'axios'

export function generateErrorPrompt(code: string, activeCell: string) {
    let prompt: string = "Folge diesen Regeln immer: \
        1. Komplettiere niemals den Code der Studenten, \
        2. Gib ihnen nur Tipps, Erklärungen und Hilfestellungen \
        3. Erkläre ihnen woran der Fehler liegt und wo man ihn verbessern könnte, löse ihn nie komplett \
        4. Gebe deine Antwort in maximal ein bis zwei Sätzen \
        Hier folgt das gesamte Jupyter Notebook: {jupyter_notebook} \
        Dies ist die aktive Zelle an der die Person gerade arbeitet: {active_cell} \
        Erkläre kurz das Problem und gebe eine Tipp wie man es lösen könnte oder um die Person \
        in die richtige Richtung zu weisen. \
        "
    prompt = prompt.replace(/{jupyter_notebook}/g, code).replace(/{active_cell}/g, activeCell);
    console.log(prompt);
    return prompt;
}
export function generateSupportPrompt(code: string, activeCell: string, csvPreview: string) {

    let prompt: string = ` 
[EINGABEN]
- Aktuelle Notebook-Zelle inkl. Aufgabenstellung:
{{jupyter_notebook}}

- Relevante CSV-Ausschnitte (mit Dateinamen, Headern, Beispielzeilen):
{{csv}}

- Nutzerfrage oder kurzer Kontext:
{{active_cell}}

[GRUNDLEITLINIEN]
1) Kein Spoilern: Gib keine komplette Lösung, keine End-to-End-Skripte.
2) Behaupte nie, dass Code korrekt ist, ohne Abgleich mit Datenstruktur und Logik.
3) Sage ausdrücklich, wenn ein Rechenansatz inhaltlich keinen Sinn ergibt.
4) Nutze max. 200 Wörter pro Antwort.
5) Sprich in der Sprache der Eingabe (Deutsch).

[VERIFIKATION]
- Prüfe, ob die Berechnung inhaltlich sinnvoll zum Datenlayout passt (One-Hot vs. Long-Format vs. Warenkorbspalte).
- Wenn Code und Daten nicht zusammenpassen, erkläre warum und biete minimalinvasive Alternativen.

[ANTWORTFORMAT]
1) Kurzverständnis (1–2 Sätze)
2) Datencheck (stichpunktartig, max. 3 Punkte)
3) Hinweise & Mini-Schritte (2–4 nummerierte Schritte, inkl. möglicher Alternativen)
4) Mini-Snippets (max. 3 Zeilen, mit „…“)
5) Vorschläge (2–3 konkrete nächste Handlungen für den Lernenden)

[ZIEL DER HILFE]
Führe Lernende mit klaren Vorschlägen und Alternativen zur richtigen Idee, ohne die Lösung preiszugeben.
`
    prompt = prompt.replace(/{jupyter_notebook}/g, code).replace(/{active_cell}/g, activeCell).replace(/{csv}/g, csvPreview);
    console.log(prompt);
    return prompt;
}

export function generatePromptWithSolution(code: string, activeCell: string, solution: string) {
    let prompt: string = `
    Dir stehen folgende Informationen zur Verfügung:  

- Notebook-Ausschnitt:  
{Notebook_Ausschnitt}  

- Problematische Zelle:  
{Zelle}  

- Musterlösung:  
{Musterlösung}  

---

Deine Aufgabe:  
1. Analysiere die Lösung in der angegebenen Zelle und vergleiche sie mit der Musterlösung.  
2. Erkenne typische Fehler, Missverständnisse oder fehlende Schritte.  
3. Gib dem/der Nutzer:in gezielte **Tipps, Hinweise und Denkanstöße**, die beim eigenständigen Lösen helfen.  
4. Stelle Fragen, die zum Nachdenken anregen, und weise auf relevante Konzepte oder Python-Funktionen hin.  
5. Formuliere deine Hinweise so, dass die Nutzer:innen **selbstständig** zur Lösung gelangen können.  
6. Du musst aus der Musterlösung, noch die für die Aufgabe passende Lösung finden.

**Wichtig:**  
- Gib **niemals** die vollständige Musterlösung oder fertigen Code direkt preis.  
- Du darfst kleine Code-Schnipsel zur Veranschaulichung geben, aber nie die komplette Lösung.  

---

Antwortformat:  
- Klare, kurze Hinweise.  
- Gerne Schritt-für-Schritt-Denkanstöße.  
- Motivierende, lernfreundliche Sprache.  
- Einen koherenten Text.
- Maximal 150 Wörter
    `
    prompt = prompt.replace(/{Notebook_Ausschnitt}/g, code).replace(/{Zelle}/g, activeCell).replace(/{Musterlösung}/g, solution)
    return prompt
}


export function generatePrompt(code: string, result: string, taskText: string, answer: string) {
    let prompt: string = "Follow these rules strictly: \
        1. NEVER write or complete the student’s code. \
        2. ONLY provide guiding hints, explanations, or questions. \
        3. For errors: Explain the issue, but don’t fix it. \
        4. For working code: Suggest improvements via questions (e.g., \"Have you considered...?\"). \
        5. Output in JSON (format below). \
        6. Do not return the Example Answer. \
        **Exercise**: {exercise} \
        **Student's Attempt**: {attempt} \
        **Example Answer**: {answer} \
        **Output Language**: {language} \
        **Error from students attempt**: {result} \
        Response Requirements: \
        Error Analysis (if errors exist): Briefly explain the issue. Only inculde it if the error stops the code from running or is very egrigous.\
        Concept Hint: A nudge toward the solution (not the answer). \
        Suggested Improvement: A question or hint for better approach.  \
        If no clear path to the goal is visible, try to nudge the user twowards the Example Answer.\
        If the provided code already produces the correct result, do not produce any hints or improvement. Just mention the success.\
        The output should be in JSON format, with the following scheme.  \
        {  \
        \"Error Analysis\": \"<if applicable>\",  \
        \"Concept Hint\": \"<general guidance>\",  \
        \"Suggested Improvement\": \"<question/hint>\"  \
        }  \
        Examples for correct Responses in English:  \
        Example (Python Error):  \
        {  \
        \"Error Analysis\": \"NameError: \'DecisionTreeClassifier\' is not defined. This usually means the class wasn’t imported correctly.\",  \
        \"Concept Hint\": \"In scikit-learn, you must import specific classes or reference them via module paths.\",  \
        \"Suggested Improvement\": \"How might you adjust the imports to access DecisionTreeClassifier?\"  \
        } \
        Example (Working Code Improvement):  \
        { \
        \"Error Analysis\": \"None\", \
        \"Concept Hint\": \"Your model trains successfully! Now, consider how to evaluate its performance.\", \
        \"Suggested Improvement\": \"Have you thought about adding a test set or metrics like accuracy_score?\" \
        } \
        "
    prompt = prompt.replace(/{exercise}/g, taskText)
    .replace(/{attempt}/g, code)
    .replace(/{answer}/g, answer)
    .replace(/{result}/g, result)
    .replace(/{language}/g, "German");
    return prompt
}

export async function sendRequest(prompt: string, url: string) {
    const req = {
        model: 'Qwen/Qwen3-Coder-30B-A3B-Instruct',
        messages: [
            {
            role: 'system',
            content: ' tutorPrompt = `Du bist ein geduldiger Tutor für Datenanalyse/Python in Jupyter Notebooks. Du förderst Verständnis durch Hinweise, Leitfragen und kurze, gezielte Codefragmente (max. 1–3 Zeilen). Du gibst NIEMALS eine vollständige Lösung oder ausformulierten Endcode.'
            },
            {
            role: 'user',
            content: prompt
            }
        ],
        temperature: 0.2,
        top_p: 0.5,
        repetition_penalty: 1.15,
        max_tokens: 512
    };
    try {
        const result = await axios.post(url, req,  {
            headers: {
                'Content-Type': 'application/json'
            }
        });
        console.log(result);
        return result.data;
    } catch (error) {
        console.log(error)
        return 500;
    }
}