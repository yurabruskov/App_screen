# Правильная последовательность для чистого merge

## Проблема
При обычном merge в GitHub появляются конфликты и грязная история с множеством merge-коммитов.

## Решение: git reset --hard + force push

### Шаг 1: Сохранить изменения в патч
```bash
git diff main HEAD > /tmp/my-changes.patch
cat /tmp/my-changes.patch | head -50  # Проверить что патч создан
```

### Шаг 2: Переключиться на проблемную ветку
```bash
git checkout <branch-name>
# Например: git checkout claude/device-rotation-handle-011CUs4YoXZt4TAiK9ZemdQH
```

### Шаг 3: ПОЛНОСТЬЮ сбросить ветку к состоянию main (КЛЮЧЕВОЙ МОМЕНТ!)
```bash
git reset --hard main
```

### Шаг 4: Применить сохраненные изменения
```bash
git apply /tmp/my-changes.patch
git status  # Проверить что изменения применились
```

### Шаг 5: Добавить изменения в staging
```bash
git add .
# Или конкретные файлы: git add components/banner-generator.tsx
```

### Шаг 6: Создать ОДИН чистый коммит от main
```bash
git commit -m "$(cat <<'EOF'
feat: Краткое описание

Детальное описание изменений:
- Пункт 1
- Пункт 2
- Пункт 3
EOF
)"
```

### Шаг 7: Force push для перезаписи истории
```bash
git push -f -u origin <branch-name>
```

### Шаг 8: Проверить чистую историю
```bash
git log --oneline --graph -5
```

Должно быть:
```
* abc1234 feat: Ваш коммит  ← новый коммит
* xyz5678 Merge pull request #N... ← последний коммит из main
```

### Шаг 9: Создать PR через прямую ссылку
```
https://github.com/USER/REPO/compare/main...BRANCH
```

Например:
```
https://github.com/yurabruskov/App_screen/compare/main...claude/device-rotation-handle-011CUs4YoXZt4TAiK9ZemdQH
```

## Ключ успеха
✅ `git reset --hard main` + force push = чистая история без конфликтов
✅ Один коммит от актуального main
✅ Никаких merge-коммитов в feature-ветке

## Важные замечания
- ⚠️ Force push перезаписывает историю - используйте только для своих веток
- ⚠️ Убедитесь что патч создан перед reset --hard
- ⚠️ После force push старые PR могут показывать странную историю - это нормально
- ✅ GitHub автоматически обновит открытый PR после force push

## История успешного применения
- PR #52, #53, #54, #55 - исправлены с помощью этого метода
- PR device-rotation-handle - применен этот метод
