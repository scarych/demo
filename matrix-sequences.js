// результирующий массив с данными
const result = [];

// определим границы
const maxRangeValue = 100;
const minRangeValue = -100;

if (minRangeValue >= maxRangeValue) {
  throw new Error("`maxRangeValue` must be greater than `minRangeValue`");
}

// определим размер последовательности, на которой требуется менять знак
const maxSameSignSequenceSize = 3;

// для длины последовательностей меньше 3 мой алгоритм не работает
// так как требуется гораздо больше замен чтобы из произвольно взятых комбинаций чисел получались +|-|+|-|...
if (maxSameSignSequenceSize <= 2) {
  throw new Error("`maxSameSignSequenceSize` must be greater than 2");
}

// установим размер матрицы
const matrixSize = 10;

if (matrixSize < maxSameSignSequenceSize) {
  throw new Error("`matrixSize` must be greater than `maxSameSignSequenceSize`");
}

// генерация целое случайное число в указанном диапазоне
function getRandomValue(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// определим максимальный размер строки, до которого требуется уравнять все значения отступами
const maxStringSize = Math.max(String(maxRangeValue).length, String(minRangeValue).length);

// отформатируем значения пробелами до комфортной длины
function padStartValue(value) {
  // всегда добавим дополнительный отступ, чтобы у строк с максимальной длиной тоже было пространство
  return String(value).padStart(maxStringSize + 1, " ");
}

// разделитель значений в строке
const delimeter = "|";
// получить форматированную строку значений
function formattedString(values, summary) {
  const result = [];
  // для каждого значения отобразим форматированное представление
  values.forEach((value) => {
    const formattedValue = `${padStartValue(value)}${summary.minValue === value ? "*" : " "} `;
    result.push(delimeter, formattedValue);
  });
  // добавим значение максимального положительного числа (если положительного нет, то будет пустая строка)
  result.push(
    delimeter,
    delimeter,
    `${` Min Positive:`}${padStartValue(summary.minPositiveValue || "x")}${" "}`
  );
  // добавим количество требуемых замен
  result.push(delimeter, `${" Replacements: "}${summary.changesRequirements}`);
  return result.join("");
}

// получить знак для текущего значения
function getSign(value) {
  if (value > 0) {
    return "+";
  } else if (value < 0) {
    return "-";
  } else {
    return "";
  }
}

for (let i = 0; i < matrixSize; i++) {
  const values = [];
  // создадим структуру для хранения полезной информации
  const rowSummary = {
    minValue: undefined, // минимальное число
    minPositiveValue: undefined, // минимальное положительное число
    changesRequirements: 0, // требуется перестановки для предотвращения цепочек
  };

  // действующий знак последовательности
  let sequenceSign;
  // накопленный размер последовательности одного знака
  let sameSignSequenceSize;
  for (let j = 0; j < matrixSize; j++) {
    // возмьем случайное число для ячейки
    const randomValue = getRandomValue(minRangeValue, maxRangeValue);
    values.push(randomValue);

    // зафиксируем минимальное значение в строке
    // если ранее не было установлено, то сравним с максимально возможным значением
    rowSummary.minValue = Math.min(randomValue, rowSummary.minValue || maxRangeValue);

    // если случайное значение положительное, то найдем минимальное положительное значение
    // если ранее не было установлено, то сравним с максимально возможным значением
    if (randomValue > 0) {
      rowSummary.minPositiveValue = Math.min(
        randomValue,
        rowSummary.minPositiveValue || maxRangeValue
      );
    }

    const currentSign = getSign(randomValue);
    // если это не первая позиция, то можно сравнивать с предыдущим состоянием
    // при этом сам текущий знак должен быть определен (то есть не равен 0, пограничный случай)
    // и если знак последовательность равен знаку текущего значения
    if (j > 0 && currentSign && sequenceSign === currentSign) {
      sameSignSequenceSize++; // увеличиваем размер последовательности одного и того же знака
      // если размер последовательности одного знака достиг предела
      if (sameSignSequenceSize === maxSameSignSequenceSize) {
        rowSummary.changesRequirements++; // увеличивем количество требуемых замен в строке
        sameSignSequenceSize = 0; // сбросим длину последовательности до 0
        // смысл такой, что если дальше будет продолжаться последовательность из того же знака
        // то ей при максимальном количестве последовательности 3 требуется достичь длины 6
        // (еще три подряд того же знака) чтобы количество замен, которые в ней потребуются стало на 1 больше
        // появление числа любого другого знака будет создавать новую последовательность, имеющей размер 1
      }
    } else {
      // если это первая операция в цикле, или условие изменилось, то
      sameSignSequenceSize = 1; // сбросим длину последовательности до 1
      sequenceSign = currentSign; // присвоим в текущий знак последовательности знак текущего значения
    }
  }

  // поместим в результат отформатированную строку значений с учетом сводки по строке
  result.push(formattedString(values, rowSummary));
}

console.log(result.join("\n"));
