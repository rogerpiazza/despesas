export function currentMonthYear() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

export function formatMonthYear(my) {
  const [year, month] = my.split('-')
  const months = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
  return `${months[parseInt(month) - 1]} ${year}`
}

export function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0)
}

export function formatDate(dateStr) {
  if (!dateStr) return '-'
  const [y, m, d] = dateStr.split('-')
  return `${d}/${m}/${y}`
}

/**
 * Calcula a sugestão de pagamento para o mês.
 * Retorna para cada conta fixa: quem deveria pagar, baseado em:
 * 1. Proporção de renda (quem ganha mais paga mais)
 * 2. Timing (a renda disponível antes do vencimento)
 *
 * @param {Array} incomes  - [{person_id, person_name, amount, received_date}]
 * @param {Array} bills    - [{id, name, due_day, amount}]
 * @returns {Array} suggestions - [{bill, payer_id, payer_name, income_source, reason}]
 */
export function calculateSuggestions(incomes, bills) {
  if (!incomes.length || !bills.length) return []

  // Agrupa renda por pessoa
  const byPerson = {}
  for (const inc of incomes) {
    if (!byPerson[inc.person_id]) {
      byPerson[inc.person_id] = { person_id: inc.person_id, person_name: inc.person_name, total: 0, incomes: [] }
    }
    byPerson[inc.person_id].total += Number(inc.amount)
    byPerson[inc.person_id].incomes.push(inc)
  }

  const people = Object.values(byPerson)
  const grandTotal = people.reduce((s, p) => s + p.total, 0)
  if (grandTotal === 0) return []

  // Calcula cota proporcional de cada pessoa
  for (const p of people) {
    p.proportion = p.total / grandTotal
    p.quota = 0 // quanto já foi atribuído a ela
  }

  const totalBills = bills.reduce((s, b) => s + Number(b.amount), 0)

  // Ordena contas por dia de vencimento
  const sortedBills = [...bills].sort((a, b) => a.due_day - b.due_day)

  const suggestions = []

  for (const bill of sortedBills) {
    const billAmount = Number(bill.amount)

    // Encontra a pessoa que tem renda disponível antes do vencimento
    // e ainda está dentro da proporção
    let bestPayer = null
    let bestIncome = null
    let bestScore = -Infinity

    for (const p of people) {
      // Renda recebida antes ou no dia do vencimento
      const availableIncomes = p.incomes
        .filter(inc => {
          const day = new Date(inc.received_date).getDate()
          return day <= bill.due_day
        })
        .sort((a, b) => new Date(b.received_date) - new Date(a.received_date)) // mais recente primeiro

      if (!availableIncomes.length) continue

      // Score: quanto essa pessoa ainda tem de espaço na proporção dela
      const expectedQuota = p.proportion * totalBills
      const remainingQuota = expectedQuota - p.quota
      const score = remainingQuota

      if (score > bestScore) {
        bestScore = score
        bestPayer = p
        bestIncome = availableIncomes[0]
      }
    }

    // Fallback: se ninguém tem renda antes do vencimento, pega quem tem mais proporção restante
    if (!bestPayer) {
      bestPayer = people.reduce((best, p) => {
        const expectedQuota = p.proportion * totalBills
        const remaining = expectedQuota - p.quota
        const bestRemaining = best.proportion * totalBills - best.quota
        return remaining > bestRemaining ? p : best
      })
      bestIncome = bestPayer.incomes.sort((a, b) => new Date(a.received_date) - new Date(b.received_date))[0]
    }

    bestPayer.quota += billAmount

    suggestions.push({
      bill,
      payer_id: bestPayer.person_id,
      payer_name: bestPayer.person_name,
      income_name: bestIncome?.income_source_name || 'Renda',
      income_date: bestIncome?.received_date,
      proportion: (bestPayer.proportion * 100).toFixed(1),
    })
  }

  return suggestions
}

/**
 * Calcula o encontro de contas do mês.
 * Retorna quanto cada pessoa pagou, quanto deveria pagar e o saldo.
 */
export function calculateSettlement(incomes, billPayments, extras) {
  const byPerson = {}

  const allPayments = [
    ...billPayments.map(p => ({ person_id: p.paid_by, person_name: p.person_name, amount: Number(p.amount) })),
    ...extras.map(e => ({ person_id: e.paid_by, person_name: e.person_name, amount: Number(e.amount) })),
  ]

  // Inicializa com rendas
  for (const inc of incomes) {
    if (!byPerson[inc.person_id]) {
      byPerson[inc.person_id] = { person_id: inc.person_id, person_name: inc.person_name, income: 0, paid: 0 }
    }
    byPerson[inc.person_id].income += Number(inc.amount)
  }

  // Soma pagamentos
  for (const pay of allPayments) {
    if (!byPerson[pay.person_id]) {
      byPerson[pay.person_id] = { person_id: pay.person_id, person_name: pay.person_name, income: 0, paid: 0 }
    }
    byPerson[pay.person_id].paid += pay.amount
  }

  const people = Object.values(byPerson)
  const grandTotal = people.reduce((s, p) => s + p.income, 0)
  const totalPaid = people.reduce((s, p) => s + p.paid, 0)

  for (const p of people) {
    p.proportion = grandTotal > 0 ? p.income / grandTotal : 1 / people.length
    p.shouldPay = p.proportion * totalPaid
    p.balance = p.paid - p.shouldPay // positivo = pagou mais do que devia
  }

  // Calcula transferência: quem pagou menos deve transferir para quem pagou mais
  let transfer = null
  if (people.length === 2) {
    const [a, b] = people
    if (Math.abs(a.balance) > 0.01) {
      const debtor = a.balance < 0 ? a : b
      const creditor = a.balance > 0 ? a : b
      transfer = {
        from: debtor.person_name,
        to: creditor.person_name,
        amount: Math.abs(debtor.balance),
      }
    }
  }

  return { people, totalPaid, grandTotal, transfer }
}
